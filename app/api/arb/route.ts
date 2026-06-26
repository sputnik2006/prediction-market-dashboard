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
 *
 * Walking ~24 pairs' books is ~1.5s, so the result is cached with
 * stale-while-revalidate + in-flight dedup: only the first build blocks, every
 * later request (and the 12s client poll) gets the cached radar instantly while
 * it refreshes in the background.
 */
const ARB_TTL_MS = 20_000;
let arbCache: { body: ArbResponse; at: number } | null = null;
let arbBuilding: Promise<ArbResponse> | null = null;

async function buildArb(): Promise<ArbResponse> {
  const { pairs, venues } = await resolvePairs();
  const candidates = pairs
    .filter((p) => p.polymarket && p.kalshi && (p.spread ?? 0) > 0.015)
    .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0))
    .slice(0, 24);

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
  return { rows, venues, updatedAt: new Date().toISOString() };
}

export async function GET() {
  const fresh = arbCache && Date.now() - arbCache.at <= ARB_TTL_MS;
  if (!fresh && !arbBuilding) {
    arbBuilding = buildArb()
      .then((b) => {
        arbCache = { body: b, at: Date.now() };
        return b;
      })
      .finally(() => {
        arbBuilding = null;
      });
  }
  // Serve cached instantly (stale-while-revalidate); only the first build blocks.
  if (arbCache) {
    if (!fresh) arbBuilding?.catch(() => {});
    return jsonOk(arbCache.body, 10);
  }
  return jsonOk(await arbBuilding!, 10);
}
