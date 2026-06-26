import { fetchKalshiMarket } from "@/lib/kalshi";
import { fetchPolymarketMarket } from "@/lib/polymarket";
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

  const market =
    venue === "kalshi"
      ? await fetchKalshiMarket(nativeId)
      : venue === "polymarket"
        ? await fetchPolymarketMarket(nativeId)
        : null;

  if (!market) return jsonError("Market not found", 404);
  return jsonOk(market, cacheSeconds.market);
}
