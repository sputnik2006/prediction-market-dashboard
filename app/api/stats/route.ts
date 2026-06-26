import { getMarketSets } from "@/lib/aggregate";
import { jsonOk } from "@/lib/server";
import { cacheSeconds } from "@/lib/config";
import type { StatsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { kalshi, poly, venues } = await getMarketSets();
  const all = [...kalshi, ...poly];

  const byCategory: Record<string, number> = {};
  let vol24Total = 0;
  for (const m of all) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
    vol24Total += m.volume24h ?? 0;
  }

  const body: StatsResponse = {
    totalMarkets: all.length,
    perVenue: { polymarket: poly.length, kalshi: kalshi.length },
    vol24Total,
    byCategory,
    venues,
    updatedAt: new Date().toISOString(),
  };
  return jsonOk(body, cacheSeconds.markets);
}
