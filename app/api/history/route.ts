import { NextRequest } from "next/server";
import { fetchKalshiHistory } from "@/lib/kalshi";
import { fetchPolymarketHistory } from "@/lib/polymarket";
import { getSnapshotMarket } from "@/lib/snapshot";
import { jsonOk } from "@/lib/server";
import { cacheSeconds } from "@/lib/config";
import { resampleSeries, bucketSeconds } from "@/lib/series";
import type { DataMode, HistoryResponse, PricePoint, PriceSeries, Venue } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/history?range=1w&m=kalshi:KXPRESPERSON-28-MRUB&m=polymarket:0xsnap-...
 * Returns one PriceSeries per `m` so the dual-line chart is a single request.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const range = sp.get("range") ?? "1w";
  const refs = sp.getAll("m");

  const raw: PriceSeries[] = await Promise.all(
    refs.map(async (ref): Promise<PriceSeries> => {
      const idx = ref.indexOf(":");
      const venue = ref.slice(0, idx) as Venue;
      const nativeId = ref.slice(idx + 1);

      let points: PricePoint[] = [];
      let mode: DataMode = "live";
      if (venue === "kalshi") {
        points = await fetchKalshiHistory(nativeId, range);
      } else if (venue === "polymarket") {
        points = await fetchPolymarketHistory(nativeId, range);
        mode = getSnapshotMarket(nativeId) ? "snapshot" : "live";
      }
      return {
        venue,
        marketId: `${venue}:${nativeId}`,
        label: venue === "kalshi" ? "Kalshi" : "Polymarket",
        points,
        mode,
      };
    })
  );

  // Put every series on a shared uniform time grid so the chart's (index-based)
  // time axis is uniform and correctly labeled.
  const series = resampleSeries(raw, range, Math.floor(Date.now() / 1000));

  const body: HistoryResponse = {
    series,
    interval: range,
    gridSeconds: bucketSeconds(range),
    updatedAt: new Date().toISOString(),
  };
  return jsonOk(body, cacheSeconds.history);
}
