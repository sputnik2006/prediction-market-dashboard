import { resolvePairs } from "@/lib/aggregate";
import { fetchKalshiOrderbook } from "@/lib/kalshi";
import { fetchPolymarketOrderbook } from "@/lib/polymarket";
import { computeArb } from "@/lib/arb";
import { jsonOk } from "@/lib/server";
import type { ArbResponse, ArbRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Depth-aware arbitrage radar: for every matched pair, walk BOTH order books to
 * compute the executable size and net profit (after fees), not just top-of-book.
 */
export async function GET() {
  const { pairs, venues } = await resolvePairs();
  // Only walk order books for pairs whose mid-price spread could clear fees —
  // sorted by divergence, capped — so the radar stays fast with many pairs.
  const candidates = pairs
    .filter((p) => p.polymarket && p.kalshi && (p.spread ?? 0) > 0.015)
    .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0))
    .slice(0, 30);

  const rows: ArbRow[] = await Promise.all(
    candidates.map(async (p): Promise<ArbRow> => {
      const [kalshiBook, polyBook] = await Promise.all([
        fetchKalshiOrderbook(p.kalshi!.nativeId),
        fetchPolymarketOrderbook(p.polymarket!),
      ]);
      const closeTime = p.kalshi!.closeTime ?? p.polymarket!.closeTime;
      return {
        pairId: p.pairId,
        title: p.title,
        category: p.category,
        confidence: p.confidence,
        polyYes: p.polymarket!.yesPrice,
        kalshiYes: p.kalshi!.yesPrice,
        closeTime,
        arb: computeArb(polyBook, kalshiBook, closeTime),
      };
    })
  );

  rows.sort((a, b) => b.arb.netProfit - a.arb.netProfit);

  const body: ArbResponse = { rows, venues, updatedAt: new Date().toISOString() };
  return jsonOk(body, 10);
}
