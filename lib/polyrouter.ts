import { config, HAS_POLYROUTER } from "./config";
import { fetchJson, num, qs } from "./http";
import { toCanonicalCategory } from "./category";
import type { Market } from "./types";

/**
 * Optional PolyRouter integration. PolyRouter aggregates prediction markets and
 * is reachable from networks that block polymarket.com directly — but its API
 * requires a key (X-API-Key) and is in open beta. This module is only exercised
 * when POLYROUTER_API_KEY is set; otherwise the app uses the snapshot fallback.
 */

function headers(): Record<string, string> {
  return { "X-API-Key": config.polyrouter.apiKey };
}

export async function fetchPolyrouterStatus(): Promise<{
  reachable: boolean;
  healthy: boolean;
  message: string | null;
}> {
  try {
    const body = await fetchJson<{ data?: { status?: string } }>(
      `${config.polyrouter.baseUrl}/health`,
      { retries: 0, timeoutMs: 6000 }
    );
    const status = body?.data?.status ?? "unknown";
    return { reachable: true, healthy: status === "healthy", message: status };
  } catch (err) {
    return {
      reachable: false,
      healthy: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// PolyRouter market shape is best-effort (beta, schema may vary). Map defensively.
interface PRMarket {
  id?: string;
  market_id?: string;
  slug?: string;
  title?: string;
  question?: string;
  name?: string;
  category?: string;
  platform?: string;
  yes_price?: number | string;
  price?: number | string;
  probability?: number | string;
  outcomes?: unknown;
  volume?: number | string;
  volume_24h?: number | string;
  liquidity?: number | string;
  end_date?: string;
  close_time?: string;
  url?: string;
}

function pick<T>(...vals: (T | undefined | null)[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return null;
}

function mapPR(m: PRMarket, nowIso: string): Market | null {
  const id = pick(m.id, m.market_id, m.slug);
  if (!id) return null;
  const title = pick(m.title, m.question, m.name) ?? String(id);
  const yes = num(pick(m.yes_price, m.price, m.probability));
  return {
    id: `polymarket:${id}`,
    venue: "polymarket",
    nativeId: String(id),
    tokenIds: [],
    title,
    slug: m.slug ?? String(id),
    url: m.url ?? `https://polymarket.com/market/${m.slug ?? ""}`,
    category: toCanonicalCategory(m.category, title),
    contractType: "binary",
    outcomes: [
      { id: "yes", name: "Yes", price: yes, bid: null, ask: null },
      { id: "no", name: "No", price: yes != null ? 1 - yes : null, bid: null, ask: null },
    ],
    yesPrice: yes,
    bestBid: null,
    bestAsk: null,
    volume24h: num(pick(m.volume_24h, m.volume)),
    volumeTotal: num(m.volume),
    liquidity: num(m.liquidity),
    openInterest: null,
    closeTime: pick(m.end_date, m.close_time),
    mode: "live",
    updatedAt: nowIso,
  };
}

export async function fetchPolyrouterPolymarket(limit = 100): Promise<Market[]> {
  if (!HAS_POLYROUTER) return [];
  const url = `${config.polyrouter.baseUrl}/markets${qs({
    platform: "polymarket",
    limit,
  })}`;
  const body = await fetchJson<unknown>(url, { headers: headers(), retries: 1 });
  const arr: PRMarket[] = Array.isArray(body)
    ? (body as PRMarket[])
    : ((body as { data?: PRMarket[]; markets?: PRMarket[] })?.data ??
        (body as { markets?: PRMarket[] })?.markets ??
        []);
  const nowIso = new Date().toISOString();
  return arr.map((m) => mapPR(m, nowIso)).filter((m): m is Market => m != null);
}
