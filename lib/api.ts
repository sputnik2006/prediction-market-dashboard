import type {
  ArbResponse,
  HistoryResponse,
  Market,
  MarketSort,
  Orderbook,
  PagedMarketsResponse,
  PairsResponse,
  QuoteResponse,
  SearchResponse,
  StatsResponse,
  Venue,
  VenueStatus,
} from "./types";

export interface StatusResponse {
  venues: VenueStatus[];
  polyrouter: { reachable: boolean; healthy: boolean; message: string | null } | null;
  hasPolyrouterKey: boolean;
  updatedAt: string;
}

export interface MarketQuery {
  q?: string;
  category?: string;
  venue?: Venue | "";
  sort?: MarketSort;
  offset?: number;
  limit?: number;
}

async function j<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} on ${url}`);
  return (await r.json()) as T;
}

/** A `ref` is the string `venue:nativeId` used by the history endpoint. */
export function marketRef(m: Pick<Market, "venue" | "nativeId">): string {
  return `${m.venue}:${m.nativeId}`;
}

export const api = {
  markets: (p: MarketQuery = {}) => {
    const sp = new URLSearchParams();
    if (p.q) sp.set("q", p.q);
    if (p.category) sp.set("category", p.category);
    if (p.venue) sp.set("venue", p.venue);
    if (p.sort) sp.set("sort", p.sort);
    if (p.offset != null) sp.set("offset", String(p.offset));
    if (p.limit != null) sp.set("limit", String(p.limit));
    const qs = sp.toString();
    return j<PagedMarketsResponse>(`/api/markets${qs ? `?${qs}` : ""}`);
  },
  stats: () => j<StatsResponse>("/api/stats"),
  pairs: () => j<PairsResponse>("/api/pairs"),
  arb: () => j<ArbResponse>("/api/arb"),
  status: () => j<StatusResponse>("/api/status"),
  history: (refs: string[], range: string) =>
    j<HistoryResponse>(
      `/api/history?range=${encodeURIComponent(range)}&${refs
        .map((r) => `m=${encodeURIComponent(r)}`)
        .join("&")}`
    ),
  quote: (refs: string[]) =>
    j<QuoteResponse>(
      `/api/quote?${refs.map((r) => `m=${encodeURIComponent(r)}`).join("&")}`
    ),
  orderbook: (venue: Venue, id: string) =>
    j<Orderbook>(`/api/orderbook/${venue}/${encodeURIComponent(id)}`),
  market: (venue: Venue, id: string) =>
    j<Market>(`/api/market/${venue}/${encodeURIComponent(id)}`),
  search: (q: string) => j<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
};
