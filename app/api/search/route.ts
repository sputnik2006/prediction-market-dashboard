import { NextRequest } from "next/server";
import { searchKalshi } from "@/lib/kalshi";
import { searchPolymarket } from "@/lib/polymarket";
import { jsonOk } from "@/lib/server";
import { cacheSeconds } from "@/lib/config";
import type { Market, SearchResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return jsonOk({ markets: [], venues: [] } as SearchResponse, cacheSeconds.search);

  const [kalshi, poly] = await Promise.all([searchKalshi(q), searchPolymarket(q)]);
  const seen = new Set<string>();
  const merged: Market[] = [...kalshi, ...poly].filter((m) =>
    seen.has(m.id) ? false : seen.add(m.id)
  );
  merged.sort((a, b) => (b.volumeTotal ?? 0) - (a.volumeTotal ?? 0));

  const body: SearchResponse = { markets: merged.slice(0, 80), venues: [] };
  return jsonOk(body, cacheSeconds.search);
}
