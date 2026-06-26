import { resolvePairs } from "@/lib/aggregate";
import { jsonOk } from "@/lib/server";
import { cacheSeconds } from "@/lib/config";
import type { PairsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { pairs, venues } = await resolvePairs();
  const body: PairsResponse = {
    pairs,
    venues,
    updatedAt: new Date().toISOString(),
  };
  return jsonOk(body, cacheSeconds.pairs);
}
