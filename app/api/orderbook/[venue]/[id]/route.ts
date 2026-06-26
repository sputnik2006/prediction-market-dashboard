import { fetchKalshiOrderbook } from "@/lib/kalshi";
import { fetchPolymarketMarket, fetchPolymarketOrderbook } from "@/lib/polymarket";
import { jsonOk, jsonError } from "@/lib/server";
import { cacheSeconds } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ venue: string; id: string }> }
) {
  const { venue, id } = await ctx.params;
  const nativeId = decodeURIComponent(id);

  if (venue === "kalshi") {
    const ob = await fetchKalshiOrderbook(nativeId);
    if (!ob) return jsonError("No orderbook", 404);
    return jsonOk(ob, cacheSeconds.orderbook);
  }
  if (venue === "polymarket") {
    const market = await fetchPolymarketMarket(nativeId);
    if (!market) return jsonError("Market not found", 404);
    const ob = await fetchPolymarketOrderbook(market);
    if (!ob) return jsonError("No orderbook", 404);
    return jsonOk(ob, cacheSeconds.orderbook);
  }
  return jsonError("Unknown venue", 400);
}
