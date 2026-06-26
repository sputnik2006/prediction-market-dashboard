import { fetchKalshiMarket, fetchKalshiMarkets } from "./kalshi";
import {
  fetchPolymarketEvent,
  fetchPolymarketMarket,
  fetchPolymarketMarkets,
} from "./polymarket";
import { buildPairs } from "./match";
import { SEED_PAIRS } from "./pairs.seed";
import { EVENT_MATCHES, type EventMatch } from "./events.seed";
import type { Market, MarketPair, VenueStatus } from "./types";

export interface MarketSets {
  kalshi: Market[];
  poly: Market[];
  venues: VenueStatus[];
}

/** Fetch both venues' full (cached) corpora in parallel; each isolates failure. */
export async function getMarketSets(): Promise<MarketSets> {
  const [k, p] = await Promise.all([fetchKalshiMarkets(), fetchPolymarketMarkets()]);
  return { kalshi: k.markets, poly: p.markets, venues: [k.status, p.status] };
}

/**
 * Build cross-exchange pairs, explicitly fetching curated seed markets that
 * aren't in the top-volume corpus (e.g. specific 2028 candidates). Shared by
 * /api/pairs and /api/arb.
 */
async function buildResolvePairs(): Promise<{
  pairs: MarketPair[];
  venues: VenueStatus[];
}> {
  const { kalshi, poly, venues } = await getMarketSets();
  const kMap = new Map(kalshi.map((m) => [m.nativeId, m]));
  const pMap = new Map(poly.map((m) => [m.nativeId, m]));
  const polyLive = venues.find((v) => v.venue === "polymarket")?.mode === "live";

  // Event-level alignment inputs: fetch each shared event's full candidate field
  // from Polymarket (live only). Kalshi candidates come from the cached corpus.
  let eventInputs: { em: EventMatch; polyMarkets: Market[] }[] = [];
  const eventTask: Promise<void> = polyLive
    ? Promise.all(
        EVENT_MATCHES.map(async (em) => ({
          em,
          polyMarkets: await fetchPolymarketEvent(em.polyEventSlug),
        }))
      ).then((r) => {
        eventInputs = r.filter((e) => e.polyMarkets.length > 0);
      })
    : Promise.resolve();

  const tasks: Promise<void>[] = [eventTask];
  for (const s of SEED_PAIRS) {
    if (!kMap.has(s.kalshiTicker)) {
      tasks.push(
        fetchKalshiMarket(s.kalshiTicker).then((m) => {
          if (m) {
            kalshi.push(m);
            kMap.set(m.nativeId, m);
          }
        })
      );
    }
    const polyId = polyLive ? s.polyConditionId : s.polySnapshotId;
    if (polyId && !pMap.has(polyId)) {
      tasks.push(
        fetchPolymarketMarket(polyId).then((m) => {
          if (m) {
            poly.push(m);
            pMap.set(m.nativeId, m);
          }
        })
      );
    }
  }
  await Promise.all(tasks);

  return { pairs: buildPairs(kalshi, poly, eventInputs), venues };
}

// Cache the (expensive) pair resolution with in-flight dedup so /api/pairs and
// /api/arb share one build instead of each re-fetching events + seed markets.
const PAIRS_TTL_MS = 15_000;
let pairsCache: { data: { pairs: MarketPair[]; venues: VenueStatus[] }; at: number } | null = null;
let pairsBuilding: Promise<{ pairs: MarketPair[]; venues: VenueStatus[] }> | null = null;

export async function resolvePairs(): Promise<{
  pairs: MarketPair[];
  venues: VenueStatus[];
}> {
  if (pairsCache && Date.now() - pairsCache.at < PAIRS_TTL_MS) return pairsCache.data;
  if (!pairsBuilding) {
    pairsBuilding = buildResolvePairs()
      .then((d) => {
        const polyLive = d.venues.find((v) => v.venue === "polymarket")?.mode === "live";
        const hasEvents = d.pairs.some((p) => p.pairId.startsWith("event:"));
        // Degraded (live but event fetch failed → no event pairs) → expire in ~2s
        // so the next call retries instead of serving the thin result for 15s.
        const at = polyLive && !hasEvents ? Date.now() - (PAIRS_TTL_MS - 2000) : Date.now();
        pairsCache = { data: d, at };
        return d;
      })
      .finally(() => {
        pairsBuilding = null;
      });
  }
  // Stale-while-revalidate: serve the cached pairs instantly while the rebuild
  // runs in the background — only the first-ever build blocks a request.
  if (pairsCache) {
    pairsBuilding.catch(() => {});
    return pairsCache.data;
  }
  return pairsBuilding;
}
