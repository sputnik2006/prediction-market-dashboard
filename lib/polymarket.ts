import { config, HAS_POLYROUTER } from "./config";
import { fetchJson, num, qs } from "./http";
import { dohAgent, isDnsError } from "./doh";
import { toCanonicalCategory } from "./category";
import { fetchPolyrouterPolymarket } from "./polyrouter";
import {
  getSnapshotHistory,
  getSnapshotMarket,
  getSnapshotMarkets,
} from "./snapshot";
import type {
  Market,
  Orderbook,
  OrderbookLevel,
  PricePoint,
  VenueStatus,
} from "./types";

const WEB = config.polymarket.web;

/**
 * Polymarket-aware fetch: honors the DoH setting. "auto" tries direct DNS first
 * and transparently retries through the DoH agent on a DNS failure (so it just
 * works on networks that DNS-block polymarket.com, like India).
 */
async function polyFetch<T>(
  url: string,
  opts: { retries?: number; timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<T> {
  const mode = config.polyDoh;
  if (mode === "on") return fetchJson<T>(url, { ...opts, dispatcher: dohAgent });
  try {
    return await fetchJson<T>(url, opts);
  } catch (err) {
    if (mode !== "off" && isDnsError(err)) {
      return fetchJson<T>(url, { ...opts, dispatcher: dohAgent });
    }
    throw err;
  }
}

interface GammaEvent {
  id?: string;
  slug?: string;
  title?: string;
  category?: string;
}
interface GammaMarket {
  id?: string;
  conditionId?: string;
  question?: string;
  groupItemTitle?: string;
  slug?: string;
  outcomes?: string; // JSON-encoded
  outcomePrices?: string; // JSON-encoded
  clobTokenIds?: string; // JSON-encoded
  bestBid?: number | string;
  bestAsk?: number | string;
  lastTradePrice?: number | string;
  volume24hr?: number | string;
  volumeNum?: number | string;
  volume?: number | string;
  liquidityNum?: number | string;
  liquidity?: number | string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  enableOrderBook?: boolean;
  category?: string;
  description?: string;
  events?: GammaEvent[];
}

/** Gamma encodes these as JSON strings; tolerate arrays too. */
function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapGammaMarket(m: GammaMarket, nowIso: string): Market | null {
  const names = parseJsonArray(m.outcomes);
  const prices = parseJsonArray(m.outcomePrices).map((p) => num(p));
  const tokenIds = parseJsonArray(m.clobTokenIds);
  if (names.length === 0) return null;

  const bestBid = num(m.bestBid);
  const bestAsk = num(m.bestAsk);
  const yes =
    prices[0] ??
    num(m.lastTradePrice) ??
    (bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null);

  const ev = m.events?.[0];
  const title = m.question ?? ev?.title ?? m.slug ?? "Market";
  const outcomes = names.map((name, i) => ({
    id: tokenIds[i] ?? name.toLowerCase(),
    name,
    price: prices[i] ?? null,
    bid: i === 0 ? bestBid : null,
    ask: i === 0 ? bestAsk : null,
  }));

  return {
    id: `polymarket:${m.conditionId ?? m.id ?? m.slug}`,
    venue: "polymarket",
    nativeId: m.conditionId ?? m.id ?? m.slug ?? "",
    tokenIds,
    title,
    subtitle: m.groupItemTitle || undefined,
    slug: m.slug ?? "",
    url: ev?.slug ? `${WEB}/event/${ev.slug}` : `${WEB}/market/${m.slug ?? ""}`,
    category: toCanonicalCategory(ev?.category ?? m.category, title),
    contractType: names.length > 2 ? "categorical" : "binary",
    outcomes,
    yesPrice: yes,
    bestBid,
    bestAsk,
    volume24h: num(m.volume24hr),
    volumeTotal: num(m.volumeNum) ?? num(m.volume),
    liquidity: num(m.liquidityNum) ?? num(m.liquidity),
    openInterest: null,
    closeTime: m.endDate ?? null,
    rules: m.description || undefined,
    mode: "live",
    updatedAt: nowIso,
  };
}

function snapshotResult(reason: string): { markets: Market[]; status: VenueStatus } {
  if (config.polySnapshotEnabled) {
    return {
      markets: getSnapshotMarkets(),
      status: {
        venue: "polymarket",
        mode: "snapshot",
        ok: true,
        latencyMs: null,
        message: `Live host unreachable (${reason}); serving labeled snapshot.`,
      },
    };
  }
  return {
    markets: [],
    status: {
      venue: "polymarket",
      mode: "unreachable",
      ok: false,
      latencyMs: null,
      message: reason,
    },
  };
}

/** Lightweight reachability probe for the status route (honors DoH). */
export async function probePolymarket(): Promise<VenueStatus> {
  const started = Date.now();
  try {
    await polyFetch(`${config.polymarket.gammaUrl}/markets?limit=1`, {
      retries: 1,
      timeoutMs: 8000,
    });
    return {
      venue: "polymarket",
      mode: "live",
      ok: true,
      latencyMs: Date.now() - started,
      message: config.polyDoh === "off" ? null : "resolved via DoH where needed",
    };
  } catch {
    return {
      venue: "polymarket",
      mode: config.polySnapshotEnabled ? "snapshot" : "unreachable",
      ok: config.polySnapshotEnabled,
      latencyMs: Date.now() - started,
      message: config.polySnapshotEnabled
        ? "Live Polymarket host unreachable — serving labeled snapshot."
        : "Live Polymarket host unreachable.",
    };
  }
}

// Gamma caps `limit` at 100, so paginate with `offset` to build a broad corpus.
const POLY_PAGES = Number(process.env.POLY_PAGES ?? 4);
const POLY_TTL_MS = 180_000;
let pCorpus: { markets: Market[]; builtAt: number } | null = null;
let pBuilding: Promise<Market[]> | null = null;

function liveStatus(started: number, message: string | null = null): VenueStatus {
  return { venue: "polymarket", mode: "live", ok: true, latencyMs: Date.now() - started, message };
}

async function buildPolyCorpus(): Promise<Market[]> {
  const nowIso = new Date().toISOString();
  // Offset pages are independent (offset = page*100) → fetch them concurrently
  // instead of one-after-another. A single failed page degrades to empty rather
  // than killing the whole corpus.
  const pages = await Promise.all(
    Array.from({ length: POLY_PAGES }, (_, page) => {
      const url = `${config.polymarket.gammaUrl}/markets${qs({
        active: true,
        closed: false,
        archived: false,
        order: "volume24hr",
        ascending: false,
        limit: 100,
        offset: page * 100,
        enableOrderBook: true,
      })}`;
      return polyFetch<GammaMarket[]>(url, { retries: 1 })
        .then((b) => (Array.isArray(b) ? b : []))
        .catch(() => [] as GammaMarket[]);
    })
  );

  const out: Market[] = [];
  const seen = new Set<string>();
  for (const arr of pages) {
    for (const m of arr) {
      const mapped = mapGammaMarket(m, nowIso);
      if (mapped && mapped.yesPrice != null && !seen.has(mapped.id)) {
        seen.add(mapped.id);
        out.push(mapped);
      }
    }
  }
  // If every page failed, surface it so the snapshot / PolyRouter fallback kicks in.
  if (out.length === 0) throw new Error("polymarket corpus: all pages failed");
  out.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  return out;
}

/** Cached corpus with in-flight dedup; throws on live-fetch failure. */
async function getPolyCorpus(): Promise<Market[]> {
  if (pCorpus && Date.now() - pCorpus.builtAt < POLY_TTL_MS) return pCorpus.markets;
  if (!pBuilding) {
    pBuilding = buildPolyCorpus()
      .then((m) => {
        if (m.length) pCorpus = { markets: m, builtAt: Date.now() };
        return pCorpus?.markets ?? m;
      })
      .finally(() => {
        pBuilding = null;
      });
  }
  // Stale-while-revalidate: serve the cached corpus instantly while the rebuild
  // runs in the background — only the first-ever build blocks a request.
  if (pCorpus) {
    pBuilding.catch(() => {});
    return pCorpus.markets;
  }
  return pBuilding;
}

export async function fetchPolymarketMarkets(): Promise<{
  markets: Market[];
  status: VenueStatus;
}> {
  const started = Date.now();
  try {
    const markets = await getPolyCorpus();
    if (markets.length === 0) return snapshotResult("empty response");
    return { markets, status: liveStatus(started) };
  } catch (err) {
    // Graceful degradation: PolyRouter (if keyed) → stale cache → snapshot.
    if (HAS_POLYROUTER) {
      try {
        const viaRouter = await fetchPolyrouterPolymarket(POLY_PAGES * 100);
        if (viaRouter.length > 0) {
          viaRouter.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
          return { markets: viaRouter, status: liveStatus(started, "via PolyRouter aggregator") };
        }
      } catch {
        /* fall through */
      }
    }
    if (pCorpus) return { markets: pCorpus.markets, status: liveStatus(started, "stale cache (refresh failed)") };
    return snapshotResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Search ANY Polymarket market via Gamma /public-search (not just the corpus).
 * Returns the nested markets of matching events.
 */
export async function searchPolymarket(q: string): Promise<Market[]> {
  const term = q.trim();
  if (!term) return [];
  try {
    const url = `${config.polymarket.gammaUrl}/public-search${qs({
      q: term,
      limit_per_type: 20,
      events_status: "active",
    })}`;
    const body = await polyFetch<{
      events?: (GammaEvent & { markets?: GammaMarket[] })[];
    }>(url);
    const nowIso = new Date().toISOString();
    const out: Market[] = [];
    const seen = new Set<string>();
    for (const e of body.events ?? []) {
      for (const m of e.markets ?? []) {
        const withEvent: GammaMarket = {
          ...m,
          events: m.events ?? [{ slug: e.slug, title: e.title, category: e.category }],
        };
        const mapped = mapGammaMarket(withEvent, nowIso);
        if (mapped && mapped.yesPrice != null && !seen.has(mapped.id)) {
          seen.add(mapped.id);
          out.push(mapped);
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchGammaByCondition(conditionId: string): Promise<Market | null> {
  const url = `${config.polymarket.gammaUrl}/markets${qs({
    condition_ids: conditionId,
  })}`;
  const body = await polyFetch<GammaMarket[]>(url, { retries: 1 });
  const arr = Array.isArray(body) ? body : [];
  return arr.length ? mapGammaMarket(arr[0], new Date().toISOString()) : null;
}

// Event candidate fields are cached (they change slowly) and fetched with
// retries — the DoH path is flaky under concurrent cold-start load.
const eventCache = new Map<string, { markets: Market[]; at: number }>();
const EVENT_TTL_MS = 90_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** All candidate markets of a Polymarket categorical event (by slug). */
export async function fetchPolymarketEvent(slug: string): Promise<Market[]> {
  const hit = eventCache.get(slug);
  if (hit && Date.now() - hit.at < EVENT_TTL_MS && hit.markets.length) return hit.markets;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = `${config.polymarket.gammaUrl}/events${qs({ slug })}`;
      const body = await polyFetch<{ markets?: GammaMarket[] }[]>(url, { retries: 1 });
      const ev = Array.isArray(body) ? body[0] : (body as { markets?: GammaMarket[] });
      const nowIso = new Date().toISOString();
      const out: Market[] = [];
      for (const m of ev?.markets ?? []) {
        const mapped = mapGammaMarket(m, nowIso);
        if (mapped && mapped.yesPrice != null && mapped.subtitle) out.push(mapped);
      }
      if (out.length) {
        eventCache.set(slug, { markets: out, at: Date.now() });
        return out;
      }
    } catch {
      /* retry */
    }
    await sleep(300 * (attempt + 1));
  }
  return hit?.markets ?? []; // serve stale rather than nothing
}

export async function fetchPolymarketMarket(nativeId: string): Promise<Market | null> {
  // Snapshot ids resolve directly.
  const snap = getSnapshotMarket(nativeId);
  if (snap) return snap;
  try {
    return await fetchGammaByCondition(nativeId);
  } catch {
    return getSnapshotMarket(nativeId);
  }
}

function polyHistParams(range: string): Record<string, string | number> {
  switch (range) {
    case "1d":
      return { interval: "1d", fidelity: 1 }; // 1-min, matches Kalshi + the 1-min grid
    case "1w":
      return { interval: "1w", fidelity: 30 }; // 30-min, matches the 30-min grid
    case "1m":
      return { interval: "1m", fidelity: 60 }; // 1-hour, matches Kalshi hourly + the grid
    // No native "3m" interval, and startTs/endTs 400s for >~1mo windows
    // ("interval is too long") — use max + clip to 90d below.
    case "3m":
      return { interval: "max", fidelity: 360 };
    case "all":
      return { interval: "max", fidelity: 1440 };
    default:
      return { interval: "1w", fidelity: 60 };
  }
}

export async function fetchPolymarketHistory(
  nativeId: string,
  range = "1w"
): Promise<PricePoint[]> {
  // Snapshot markets → deterministic synthetic history.
  if (getSnapshotMarket(nativeId)) return getSnapshotHistory(nativeId, range);

  const market = await fetchGammaByCondition(nativeId).catch(() => null);
  const token = market?.tokenIds?.[0];
  if (!token) return [];
  const url = `${config.polymarket.clobUrl}/prices-history${qs({
    market: token,
    ...polyHistParams(range),
  })}`;
  const cut3m = Math.floor(Date.now() / 1000) - 90 * 86_400;

  // Retry: the DoH path occasionally resets — don't drop a whole line on a blip.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = await polyFetch<{ history?: { t: number; p: number }[] }>(url, {
        retries: 1,
      });
      let pts = (body.history ?? [])
        .map((h) => ({ t: h.t, p: h.p }))
        .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.p));
      if (range === "3m") pts = pts.filter((p) => p.t >= cut3m);
      if (pts.length) return pts;
    } catch {
      /* retry */
    }
    await sleep(300 * (attempt + 1));
  }
  return [];
}

/** Synthetic orderbook around a snapshot market's current price. */
function snapshotBook(market: Market): Orderbook {
  const mid = market.yesPrice ?? 0.5;
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];
  for (let i = 1; i <= 8; i++) {
    const bp = Math.max(0.01, Math.round((mid - i * 0.01) * 100) / 100);
    const ap = Math.min(0.99, Math.round((mid + i * 0.01) * 100) / 100);
    bids.push({ price: bp, size: Math.round(2000 + (8 - i) * 1500 + ((i * 37) % 11) * 80) });
    asks.push({ price: ap, size: Math.round(1800 + (8 - i) * 1400 + ((i * 53) % 13) * 70) });
  }
  return {
    venue: "polymarket",
    marketId: market.id,
    bids,
    asks,
    mode: "snapshot",
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchPolymarketOrderbook(
  market: Market
): Promise<Orderbook | null> {
  if (market.mode === "snapshot" || getSnapshotMarket(market.nativeId)) {
    return snapshotBook(market);
  }
  const token = market.tokenIds?.[0];
  if (!token) return null;
  try {
    const url = `${config.polymarket.clobUrl}/book${qs({ token_id: token })}`;
    const body = await polyFetch<{
      bids?: { price: string; size: string }[];
      asks?: { price: string; size: string }[];
    }>(url, { retries: 1 });
    const bids: OrderbookLevel[] = (body.bids ?? [])
      .map((l) => ({ price: num(l.price) ?? 0, size: num(l.size) ?? 0 }))
      .filter((l) => l.price > 0)
      .sort((a, b) => b.price - a.price);
    const asks: OrderbookLevel[] = (body.asks ?? [])
      .map((l) => ({ price: num(l.price) ?? 0, size: num(l.size) ?? 0 }))
      .filter((l) => l.price > 0)
      .sort((a, b) => a.price - b.price);
    return {
      venue: "polymarket",
      marketId: market.id,
      bids,
      asks,
      mode: "live",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return snapshotBook(market);
  }
}
