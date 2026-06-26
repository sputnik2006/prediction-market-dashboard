// Normalized domain model — every venue maps into these shapes.
// INVARIANT: all prices/probabilities are floats in [0,1] (never cents, never 0–100).

export type Venue = "polymarket" | "kalshi";

/** How fresh the data for a venue is in this environment. */
export type DataMode = "live" | "snapshot" | "unreachable";

export type ContractType = "binary" | "categorical" | "scalar";

/** Canonical categories the UI groups by (both venues map into these). */
export type Category =
  | "Politics"
  | "Economics"
  | "Crypto"
  | "Sports"
  | "World"
  | "Tech"
  | "Culture"
  | "Other";

export interface Outcome {
  id: string; // "yes" | "no" | clobTokenId | kalshi ticker
  name: string; // "Yes" | "No" | candidate name
  price: number | null; // mid/last probability 0–1
  bid: number | null; // 0–1
  ask: number | null; // 0–1
}

export interface Market {
  id: string; // internal stable id: `${venue}:${nativeId}`
  venue: Venue;
  nativeId: string; // Poly conditionId | Kalshi ticker
  tokenIds: string[]; // Poly clobTokenIds (parallel to outcomes); [] for Kalshi

  // Kalshi addressing (needed to build the candlesticks URL)
  seriesTicker?: string;
  eventTicker?: string;

  title: string; // human question (event-level for Kalshi)
  subtitle?: string; // outcome label, e.g. "Marco Rubio" / "Before 2029"
  slug: string; // Poly slug | Kalshi ticker
  url: string; // deep link back to the venue
  category: Category;
  contractType: ContractType;

  outcomes: Outcome[]; // index 0 = primary ("Yes")
  yesPrice: number | null; // convenience: probability of the primary outcome
  bestBid: number | null;
  bestAsk: number | null;

  volume24h: number | null;
  volumeTotal: number | null;
  liquidity: number | null;
  openInterest: number | null;
  closeTime: string | null; // ISO

  rules?: string; // settlement text (for cross-venue match verification)
  mode: DataMode; // live | snapshot
  updatedAt: string; // ISO
}

export interface PricePoint {
  t: number; // unix SECONDS
  p: number; // probability 0–1
}

export interface PriceSeries {
  venue: Venue;
  marketId: string;
  label: string;
  points: PricePoint[];
  mode: DataMode;
}

export interface OrderbookLevel {
  price: number; // 0–1
  size: number; // contracts / shares
}

export interface Orderbook {
  venue: Venue;
  marketId: string;
  bids: OrderbookLevel[]; // YES bids, sorted desc by price
  asks: OrderbookLevel[]; // YES asks, sorted asc by price
  mode: DataMode;
  updatedAt: string;
}

export interface VenueStatus {
  venue: Venue;
  mode: DataMode;
  ok: boolean;
  latencyMs: number | null;
  message: string | null;
}

export interface MarketsResponse {
  markets: Market[];
  venues: VenueStatus[];
  updatedAt: string;
}

export type MarketSort = "volume" | "volume24h" | "closing" | "price";

export interface PagedMarketsResponse {
  markets: Market[];
  total: number;
  offset: number;
  limit: number;
  venues: VenueStatus[];
  updatedAt: string;
}

export interface StatsResponse {
  totalMarkets: number;
  perVenue: Record<Venue, number>;
  vol24Total: number;
  byCategory: Record<string, number>;
  venues: VenueStatus[];
  updatedAt: string;
}

export type MatchConfidence = "verified" | "fuzzy" | "unmatched";
export type MatchMethod = "manual" | "fuzzy" | "sports" | "none";

export interface MarketPair {
  pairId: string;
  title: string;
  category: Category;
  polymarket: Market | null;
  kalshi: Market | null;
  confidence: MatchConfidence;
  matchMethod: MatchMethod;
  /** |poly.yesPrice − kalshi.yesPrice| in probability terms, or null. */
  spread: number | null;
  /** Fee-adjusted edge of buying the cheaper side, or null. */
  edge: number | null;
  /** Direction: which venue is cheaper on YES. */
  cheaperVenue: Venue | null;
  notes: string | null;
}

export interface PairsResponse {
  pairs: MarketPair[];
  venues: VenueStatus[];
  updatedAt: string;
}

export interface HistoryResponse {
  series: PriceSeries[];
  interval: string;
  /** Uniform grid step (seconds) the series were resampled onto. */
  gridSeconds: number;
  updatedAt: string;
}

export interface Quote {
  yes: number | null; // probability 0–1
  bid: number | null;
  ask: number | null;
  t: number; // unix seconds
}

export interface QuoteResponse {
  quotes: Record<string, Quote>; // keyed by `${venue}:${nativeId}`
  updatedAt: string;
}

export type DivergenceStatus = "equivalent" | "minor" | "divergent";

export interface Divergence {
  status: DivergenceStatus;
  confidence: number;
  divergenceCases: string[];
  reasoning: string;
  worstCase: string;
}

export interface ArbResult {
  hasArb: boolean;
  buyVenue: Venue | null; // buy YES here (cheaper)
  sellVenue: Venue | null; // hedge here (buy NO / exit YES into the bid)
  fillableSize: number; // shares/contracts fillable before the edge collapses
  grossProfit: number; // $ before fees
  netProfit: number; // $ after fees
  capital: number; // $ deployed across both legs
  roi: number; // netProfit / capital (0..1)
  annualizedRoi: number | null; // roi annualized by time-to-resolution
  avgEdge: number; // net profit per share (0..1)
  bestEdge: number; // net edge per share at the touch (0..1)
}

export interface ArbRow {
  pairId: string;
  title: string;
  category: Category;
  confidence: MatchConfidence;
  polyYes: number | null;
  kalshiYes: number | null;
  closeTime: string | null;
  arb: ArbResult;
}

export interface ArbResponse {
  rows: ArbRow[];
  venues: VenueStatus[];
  updatedAt: string;
}

export interface SearchResponse {
  markets: Market[];
  venues: VenueStatus[];
}

/** A standard error envelope returned by routes when a venue fails. */
export interface ApiError {
  error: string;
  detail?: string;
}
