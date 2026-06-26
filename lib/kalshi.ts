import { config } from "./config";
import { fetchJson, num, qs } from "./http";
import { toCanonicalCategory } from "./category";
import type {
  Market,
  Orderbook,
  OrderbookLevel,
  PricePoint,
  VenueStatus,
} from "./types";

// ---- Upstream response shapes (only the fields we read) ----
interface KMarket {
  ticker: string;
  event_ticker?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  subtitle?: string;
  title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  volume_fp?: string;
  volume_24h_fp?: string;
  open_interest_fp?: string;
  liquidity_dollars?: string;
  close_time?: string;
  status?: string;
  market_type?: string;
  mve_collection_ticker?: string;
  is_provisional?: boolean;
  rules_primary?: string;
}
interface KEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  sub_title?: string;
  category?: string;
  markets?: KMarket[];
}

const WEB = config.kalshi.web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function seriesOf(ticker: string): string {
  return ticker.split("-")[0];
}

/** Probability from bid/ask midpoint, falling back to last trade. */
function midOrLast(
  bid: number | null,
  ask: number | null,
  last: number | null
): number | null {
  if (bid != null && ask != null && ask >= bid && ask > 0) {
    // A full-width two-sided quote (≈1¢ / 99¢) is a market-maker placeholder, not
    // a real market — its 50% midpoint is meaningless. Defer to a real last trade,
    // else report "no price" rather than a misleading 50%.
    if (ask - bid >= 0.9) return last != null && last > 0 ? last : null;
    return (bid + ask) / 2;
  }
  if (last != null && last > 0) return last;
  if (ask != null && ask > 0) return ask;
  if (bid != null) return bid;
  return null;
}

function mapMarket(
  m: KMarket,
  ev: { series_ticker?: string; category?: string; title?: string; event_ticker?: string },
  marketsInEvent: number,
  nowIso: string
): Market {
  const series = ev.series_ticker ?? seriesOf(m.ticker);
  const yb = num(m.yes_bid_dollars);
  const ya = num(m.yes_ask_dollars);
  const nb = num(m.no_bid_dollars);
  const na = num(m.no_ask_dollars);
  const last = num(m.last_price_dollars);
  const yes = midOrLast(yb, ya, last);
  const title = ev.title ?? m.title ?? m.ticker;
  const subtitle = m.yes_sub_title ?? m.subtitle ?? undefined;

  return {
    id: `kalshi:${m.ticker}`,
    venue: "kalshi",
    nativeId: m.ticker,
    tokenIds: [],
    seriesTicker: series,
    eventTicker: ev.event_ticker ?? m.event_ticker,
    title,
    subtitle,
    slug: m.ticker,
    url: `${WEB}/markets/${series.toLowerCase()}`,
    category: toCanonicalCategory(ev.category, `${title} ${subtitle ?? ""}`),
    contractType: marketsInEvent > 1 ? "categorical" : "binary",
    outcomes: [
      { id: "yes", name: subtitle || "Yes", price: yes, bid: yb, ask: ya },
      {
        id: "no",
        name: "No",
        price: yes != null ? 1 - yes : null,
        bid: nb,
        ask: na,
      },
    ],
    yesPrice: yes,
    bestBid: yb,
    bestAsk: ya,
    volume24h: num(m.volume_24h_fp),
    volumeTotal: num(m.volume_fp),
    liquidity: num(m.liquidity_dollars),
    openInterest: num(m.open_interest_fp),
    closeTime: m.close_time ?? null,
    rules: m.rules_primary || undefined,
    mode: "live",
    updatedAt: nowIso,
  };
}

function isJunk(m: KMarket): boolean {
  return Boolean(m.mve_collection_ticker) || Boolean(m.is_provisional);
}

// How many pages of /events (200 each) to paginate for the corpus.
const KALSHI_PAGES = Number(process.env.KALSHI_PAGES ?? 4);
const CORPUS_TTL_MS = 180_000;
let kCorpus: { markets: Market[]; builtAt: number } | null = null;
let kBuilding: Promise<Market[]> | null = null;

/**
 * Build a broad Kalshi corpus by paginating the /events endpoint (the flat
 * /markets list is flooded with provisional MVE parlays). Flattens nested
 * markets, drops junk, dedupes, sorts by volume. This surfaces the long tail
 * (sports, entertainment, etc.) that a single top-200 page misses.
 */
async function buildKalshiCorpus(): Promise<Market[]> {
  const nowIso = new Date().toISOString();
  const out: Market[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < KALSHI_PAGES; page++) {
    const url = `${config.kalshi.baseUrl}/events${qs({
      status: "open",
      with_nested_markets: true,
      limit: 200,
      cursor,
    })}`;
    const body = await fetchJson<{ events?: KEvent[]; cursor?: string }>(url);
    for (const ev of body.events ?? []) {
      const real = (ev.markets ?? []).filter((m) => !isJunk(m));
      for (const m of real) {
        const mapped = mapMarket(m, ev, real.length, nowIso);
        if (mapped.yesPrice == null && (mapped.volumeTotal ?? 0) === 0) continue;
        if (seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        out.push(mapped);
      }
    }
    cursor = body.cursor;
    if (!cursor) break;
  }
  out.sort((a, b) => (b.volumeTotal ?? 0) - (a.volumeTotal ?? 0));
  return out;
}

/** Cached corpus with in-flight dedup: concurrent callers share one build. */
async function getKalshiCorpus(): Promise<Market[]> {
  if (kCorpus && Date.now() - kCorpus.builtAt <= CORPUS_TTL_MS) return kCorpus.markets;
  if (!kBuilding) {
    kBuilding = buildKalshiCorpus()
      .then((m) => {
        if (m.length) kCorpus = { markets: m, builtAt: Date.now() };
        return kCorpus?.markets ?? m;
      })
      .finally(() => {
        kBuilding = null;
      });
  }
  // Stale-while-revalidate: serve the cached corpus instantly while the rebuild
  // runs in the background — only the first-ever build blocks a request.
  if (kCorpus) {
    kBuilding.catch(() => {});
    return kCorpus.markets;
  }
  return kBuilding;
}

export async function fetchKalshiMarkets(): Promise<{
  markets: Market[];
  status: VenueStatus;
}> {
  const started = Date.now();
  try {
    const markets = await getKalshiCorpus();
    return {
      markets,
      status: {
        venue: "kalshi",
        mode: "live",
        ok: true,
        latencyMs: Date.now() - started,
        message: null,
      },
    };
  } catch (err) {
    // Serve stale cache rather than nothing.
    if (kCorpus) {
      return {
        markets: kCorpus.markets,
        status: {
          venue: "kalshi",
          mode: "live",
          ok: true,
          latencyMs: Date.now() - started,
          message: "stale cache (refresh failed)",
        },
      };
    }
    return {
      markets: [],
      status: {
        venue: "kalshi",
        mode: "unreachable",
        ok: false,
        latencyMs: Date.now() - started,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** Full-text filter over the Kalshi corpus (covers the broad long tail). */
export async function searchKalshi(q: string): Promise<Market[]> {
  const { markets } = await fetchKalshiMarkets();
  const n = q.toLowerCase().trim();
  if (!n) return markets;
  return markets.filter((m) =>
    `${m.title} ${m.subtitle ?? ""} ${m.category} ${m.nativeId}`
      .toLowerCase()
      .includes(n)
  );
}

/**
 * Fetch every market of a Kalshi SERIES directly (e.g. KXMENWORLDCUP). Registered
 * cross-exchange events often sit below the top-volume corpus, so we pull the full
 * candidate field straight from the series for outcome alignment.
 */
export async function fetchKalshiSeriesMarkets(series: string): Promise<Market[]> {
  const url = `${config.kalshi.baseUrl}/events${qs({
    series_ticker: series,
    with_nested_markets: true,
  })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = await fetchJson<{ events?: KEvent[] }>(url);
      const nowIso = new Date().toISOString();
      const out: Market[] = [];
      for (const ev of body.events ?? []) {
        const ms = ev.markets ?? [];
        for (const m of ms) {
          out.push(
            mapMarket(
              m,
              {
                series_ticker: ev.series_ticker ?? series,
                category: ev.category,
                title: ev.title,
                event_ticker: ev.event_ticker,
              },
              ms.length,
              nowIso
            )
          );
        }
      }
      if (out.length) return out;
    } catch {
      /* retry transient */
    }
    await sleep(300 * (attempt + 1));
  }
  return [];
}

export async function fetchKalshiMarket(ticker: string): Promise<Market | null> {
  const url = `${config.kalshi.baseUrl}/markets/${encodeURIComponent(ticker)}`;
  try {
    const body = await fetchJson<{ market?: KMarket }>(url);
    if (!body.market) return null;
    const m = body.market;
    return mapMarket(
      m,
      {
        series_ticker: seriesOf(ticker),
        category: undefined,
        title: m.title,
        event_ticker: m.event_ticker,
      },
      1,
      new Date().toISOString()
    );
  } catch {
    return null;
  }
}

function kalshiRange(range: string): { start: number; period: 1 | 60 | 1440 } {
  const now = Math.floor(Date.now() / 1000);
  switch (range) {
    case "1d":
      return { start: now - 86_400, period: 1 };
    case "1w":
      return { start: now - 7 * 86_400, period: 60 };
    case "1m":
      return { start: now - 30 * 86_400, period: 60 };
    case "3m":
      return { start: now - 90 * 86_400, period: 1440 };
    case "all":
      return { start: now - 730 * 86_400, period: 1440 };
    default:
      return { start: now - 7 * 86_400, period: 60 };
  }
}

interface KCandle {
  end_period_ts: number;
  price?: {
    close_dollars?: string | null;
    mean_dollars?: string | null;
    open_dollars?: string | null;
  };
  yes_bid?: { close_dollars?: string | null };
  yes_ask?: { close_dollars?: string | null };
}

export async function fetchKalshiHistory(
  ticker: string,
  range = "1w"
): Promise<PricePoint[]> {
  const series = seriesOf(ticker);
  const { start, period } = kalshiRange(range);
  const end = Math.floor(Date.now() / 1000);
  const url = `${config.kalshi.baseUrl}/series/${series}/markets/${encodeURIComponent(
    ticker
  )}/candlesticks${qs({ start_ts: start, end_ts: end, period_interval: period })}`;

  // Retry: candlesticks (esp. the heavy 1-min 1D request) occasionally fails —
  // don't drop the whole line on a transient blip.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = await fetchJson<{ candlesticks?: KCandle[] }>(url);
      const pts: PricePoint[] = [];
      for (const c of body.candlesticks ?? []) {
        const p =
          num(c.price?.close_dollars) ??
          num(c.price?.mean_dollars) ??
          midOrLast(
            num(c.yes_bid?.close_dollars),
            num(c.yes_ask?.close_dollars),
            null
          );
        if (p == null) continue;
        pts.push({ t: c.end_period_ts, p });
      }
      pts.sort((a, b) => a.t - b.t);
      if (pts.length) return pts;
    } catch {
      /* retry */
    }
    await sleep(300 * (attempt + 1));
  }
  return [];
}

interface KOrderbook {
  orderbook_fp?: { yes_dollars?: [string, string][]; no_dollars?: [string, string][] };
  orderbook?: { yes?: [number, number][]; no?: [number, number][] };
}

export async function fetchKalshiOrderbook(ticker: string): Promise<Orderbook | null> {
  const url = `${config.kalshi.baseUrl}/markets/${encodeURIComponent(
    ticker
  )}/orderbook${qs({ depth: 100 })}`;
  try {
    const body = await fetchJson<KOrderbook>(url);
    const fp = body.orderbook_fp;
    const legacy = body.orderbook;

    const yesRaw: [string | number, string | number][] =
      fp?.yes_dollars ?? legacy?.yes ?? [];
    const noRaw: [string | number, string | number][] =
      fp?.no_dollars ?? legacy?.no ?? [];

    const bids: OrderbookLevel[] = yesRaw
      .map(([p, s]) => ({ price: num(p) ?? 0, size: num(s) ?? 0 }))
      .filter((l) => l.price > 0)
      .sort((a, b) => b.price - a.price);

    // YES ask = 1 − NO bid price.
    const asks: OrderbookLevel[] = noRaw
      .map(([p, s]) => ({ price: 1 - (num(p) ?? 0), size: num(s) ?? 0 }))
      .filter((l) => l.price > 0 && l.price < 1)
      .sort((a, b) => a.price - b.price);

    return {
      venue: "kalshi",
      marketId: `kalshi:${ticker}`,
      bids,
      asks,
      mode: "live",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
