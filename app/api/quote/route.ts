import { NextRequest } from "next/server";
import { fetchKalshiMarket } from "@/lib/kalshi";
import { fetchPolymarketMarket } from "@/lib/polymarket";
import { jsonOk } from "@/lib/server";
import type { Quote, QuoteResponse, Venue } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tiny per-ref cache so a few-second poll (and concurrent viewers) don't hammer
// the upstreams. Live enough; bounded load.
const cache = new Map<string, { q: Quote; exp: number }>();
const TTL_MS = 2000;

async function quoteFor(ref: string): Promise<Quote | null> {
  const hit = cache.get(ref);
  if (hit && hit.exp > Date.now()) return hit.q;

  const i = ref.indexOf(":");
  if (i < 0) return null;
  const venue = ref.slice(0, i) as Venue;
  const id = ref.slice(i + 1);

  const m =
    venue === "kalshi"
      ? await fetchKalshiMarket(id)
      : venue === "polymarket"
        ? await fetchPolymarketMarket(id)
        : null;
  if (!m) return null;

  const q: Quote = {
    yes: m.yesPrice,
    bid: m.bestBid,
    ask: m.bestAsk,
    t: Math.floor(Date.now() / 1000),
  };
  cache.set(ref, { q, exp: Date.now() + TTL_MS });
  return q;
}

/** GET /api/quote?m=kalshi:TICKER&m=polymarket:0x... — current prices, live. */
export async function GET(req: NextRequest) {
  const refs = req.nextUrl.searchParams.getAll("m").slice(0, 12);
  const entries = await Promise.all(
    refs.map(async (r) => [r, await quoteFor(r)] as const)
  );
  const quotes: Record<string, Quote> = {};
  for (const [r, q] of entries) if (q) quotes[r] = q;

  const body: QuoteResponse = { quotes, updatedAt: new Date().toISOString() };
  return jsonOk(body, 1);
}
