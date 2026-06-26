import type { ArbResult, Orderbook, OrderbookLevel, Venue } from "./types";

export const EMPTY_ARB: ArbResult = {
  hasArb: false,
  buyVenue: null,
  sellVenue: null,
  fillableSize: 0,
  grossProfit: 0,
  netProfit: 0,
  capital: 0,
  roi: 0,
  annualizedRoi: null,
  avgEdge: 0,
  bestEdge: 0,
};

// Kalshi taker fee ≈ 0.07 · price · (1−price) per contract; Polymarket ~0.
function feeFor(venue: Venue, price: number): number {
  if (venue === "kalshi") return 0.07 * price * (1 - price);
  return 0;
}

interface Walk {
  buyVenue: Venue;
  sellVenue: Venue;
  size: number;
  gross: number;
  net: number;
  capital: number;
  bestEdge: number;
}

/**
 * Greedily match BUY-venue YES asks (cheapest first) against SELL-venue YES bids
 * (highest first). Each matched share = buy YES on the cheap venue + buy NO on
 * the other (= 1 − bid), which always redeems for $1, so profit per share =
 * (bid − ask) − fees. Stops when the edge (after fees) goes non-positive.
 */
function walk(
  buyAsks: OrderbookLevel[],
  buyVenue: Venue,
  sellBids: OrderbookLevel[],
  sellVenue: Venue
): Walk {
  const asks = [...buyAsks].sort((a, b) => a.price - b.price);
  const bids = [...sellBids].sort((a, b) => b.price - a.price);

  let i = 0;
  let j = 0;
  let ra = asks[0]?.size ?? 0;
  let rb = bids[0]?.size ?? 0;
  let size = 0;
  let gross = 0;
  let net = 0;
  let capital = 0;
  let bestEdge = 0;

  while (i < asks.length && j < bids.length) {
    const a = asks[i].price;
    const b = bids[j].price;
    if (b <= a) break;
    const feePer = feeFor(buyVenue, a) + feeFor(sellVenue, 1 - b);
    const netPer = b - a - feePer;
    if (netPer <= 0) break;

    const qty = Math.min(ra, rb);
    if (qty <= 0) break;

    if (size === 0) bestEdge = netPer; // edge at the touch
    size += qty;
    gross += (b - a) * qty;
    net += netPer * qty;
    capital += (a + (1 - b)) * qty;

    ra -= qty;
    rb -= qty;
    if (ra <= 1e-9) ra = asks[++i]?.size ?? 0;
    if (rb <= 1e-9) rb = bids[++j]?.size ?? 0;
  }

  return { buyVenue, sellVenue, size, gross, net, capital, bestEdge };
}

function yearsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (t - Date.now()) / (365.25 * 86_400_000);
}

/**
 * Depth-aware cross-exchange arbitrage. Tries both directions and returns the
 * more profitable one (if any survives fees).
 */
export function computeArb(
  polyBook: Orderbook | null | undefined,
  kalshiBook: Orderbook | null | undefined,
  closeTime?: string | null
): ArbResult {
  if (!polyBook || !kalshiBook) return EMPTY_ARB;

  const dir1 = walk(polyBook.asks, "polymarket", kalshiBook.bids, "kalshi"); // buy YES poly, hedge kalshi
  const dir2 = walk(kalshiBook.asks, "kalshi", polyBook.bids, "polymarket"); // buy YES kalshi, hedge poly
  const best = dir1.net >= dir2.net ? dir1 : dir2;

  if (best.net <= 0 || best.size <= 0) return EMPTY_ARB;

  const roi = best.capital > 0 ? best.net / best.capital : 0;
  const years = yearsUntil(closeTime);
  const annualizedRoi = years && years > 0.02 ? roi / years : null;

  return {
    hasArb: true,
    buyVenue: best.buyVenue,
    sellVenue: best.sellVenue,
    fillableSize: best.size,
    grossProfit: best.gross,
    netProfit: best.net,
    capital: best.capital,
    roi,
    annualizedRoi,
    avgEdge: best.net / best.size,
    bestEdge: best.bestEdge,
  };
}
