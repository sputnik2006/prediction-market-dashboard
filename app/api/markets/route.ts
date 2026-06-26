import { NextRequest } from "next/server";
import { getMarketSets } from "@/lib/aggregate";
import { searchPolymarket } from "@/lib/polymarket";
import { jsonOk } from "@/lib/server";
import { cacheSeconds } from "@/lib/config";
import type { Market, MarketSort, PagedMarketsResponse, Venue } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hay = (m: Market) =>
  `${m.title} ${m.subtitle ?? ""} ${m.category} ${m.nativeId}`.toLowerCase();

function dedupe(ms: Market[]): Market[] {
  const seen = new Set<string>();
  return ms.filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));
}

function sortMarkets(ms: Market[], sort: MarketSort): Market[] {
  const arr = [...ms];
  const now = Date.now();
  switch (sort) {
    case "volume24h":
      arr.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
      break;
    case "price":
      arr.sort((a, b) => (b.yesPrice ?? -1) - (a.yesPrice ?? -1));
      break;
    case "closing":
      arr.sort((a, b) => {
        const ta = a.closeTime ? Date.parse(a.closeTime) : Infinity;
        const tb = b.closeTime ? Date.parse(b.closeTime) : Infinity;
        // push already-closed / unparseable to the bottom
        const va = !Number.isFinite(ta) || ta < now ? Infinity : ta;
        const vb = !Number.isFinite(tb) || tb < now ? Infinity : tb;
        return va - vb;
      });
      break;
    default:
      arr.sort((a, b) => (b.volumeTotal ?? 0) - (a.volumeTotal ?? 0));
  }
  return arr;
}

/**
 * GET /api/markets?q=&category=&venue=&sort=&offset=&limit=
 * Server-side filter + sort + pagination over the full cross-venue corpus.
 * With `q`, also hits Polymarket's public-search so ANY market is findable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const category = sp.get("category") ?? "";
  const venue = (sp.get("venue") ?? "") as Venue | "";
  const sort = (sp.get("sort") ?? "volume") as MarketSort;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 48) || 48));

  const { kalshi, poly, venues } = await getMarketSets();

  let pool: Market[];
  if (q) {
    const nq = q.toLowerCase();
    const kHits = kalshi.filter((m) => hay(m).includes(nq));
    const pCorpusHits = poly.filter((m) => hay(m).includes(nq));
    const pSearch = await searchPolymarket(q);
    pool = dedupe([...kHits, ...pCorpusHits, ...pSearch]);
  } else {
    pool = [...kalshi, ...poly];
  }

  if (category) pool = pool.filter((m) => m.category === category);
  if (venue) pool = pool.filter((m) => m.venue === venue);

  pool = sortMarkets(pool, sort);
  const total = pool.length;
  const page = pool.slice(offset, offset + limit);

  const body: PagedMarketsResponse = {
    markets: page,
    total,
    offset,
    limit,
    venues,
    updatedAt: new Date().toISOString(),
  };
  return jsonOk(body, cacheSeconds.markets);
}
