// Clearly-labeled DEMO snapshot of Polymarket markets.
// Used ONLY when the live Polymarket host is unreachable (e.g. corporate DNS
// block) and no PolyRouter key is configured. Every market built here carries
// mode:"snapshot" so the UI can badge it loudly as non-live, illustrative data.
//
// Prices are plausible approximations for well-known markets and are paired to
// REAL, live Kalshi tickers (via `pairKey`) so the cross-exchange comparison is
// demonstrable. History is a deterministic synthetic walk (stable per id).

import type { Category, Market, PricePoint } from "./types";

interface SnapSpec {
  id: string; // conditionId-like
  slug: string;
  title: string;
  subtitle?: string;
  category: Category;
  yes: number; // current YES probability 0–1
  vol24: number;
  volTotal: number;
  liquidity: number;
  closeTime: string;
  pairKey?: string; // links to a Kalshi market in pairs.seed.ts
}

const SPECS: SnapSpec[] = [
  // ---- 2028 US Presidential election (pairs to live KXPRESPERSON-28-*) ----
  {
    id: "0xsnap-pres28-newsom",
    slug: "presidential-election-winner-2028",
    title: "2028 U.S. Presidential Election Winner",
    subtitle: "Gavin Newsom",
    category: "Politics",
    yes: 0.15,
    vol24: 184_000,
    volTotal: 9_400_000,
    liquidity: 410_000,
    closeTime: "2028-11-07T05:00:00Z",
    pairKey: "pres-2028-newsom",
  },
  {
    id: "0xsnap-pres28-vance",
    slug: "presidential-election-winner-2028",
    title: "2028 U.S. Presidential Election Winner",
    subtitle: "J.D. Vance",
    category: "Politics",
    yes: 0.16,
    vol24: 162_000,
    volTotal: 8_900_000,
    liquidity: 388_000,
    closeTime: "2028-11-07T05:00:00Z",
    pairKey: "pres-2028-vance",
  },
  {
    id: "0xsnap-pres28-rubio",
    slug: "presidential-election-winner-2028",
    title: "2028 U.S. Presidential Election Winner",
    subtitle: "Marco Rubio",
    category: "Politics",
    yes: 0.21,
    vol24: 142_000,
    volTotal: 7_700_000,
    liquidity: 352_000,
    closeTime: "2028-11-07T05:00:00Z",
    pairKey: "pres-2028-rubio",
  },
  {
    id: "0xsnap-pres28-aoc",
    slug: "presidential-election-winner-2028",
    title: "2028 U.S. Presidential Election Winner",
    subtitle: "Alexandria Ocasio-Cortez",
    category: "Politics",
    yes: 0.08,
    vol24: 96_000,
    volTotal: 5_100_000,
    liquidity: 240_000,
    closeTime: "2028-11-07T05:00:00Z",
    pairKey: "pres-2028-aoc",
  },
  // ---- Greenland (pairs to live KXGREENLAND-29 / KXGREENTERRITORY-29) ----
  {
    id: "0xsnap-greenland-buy",
    slug: "will-trump-buy-greenland",
    title: "Will Trump buy at least part of Greenland before 2029?",
    subtitle: "Yes",
    category: "Politics",
    yes: 0.19,
    vol24: 54_000,
    volTotal: 3_600_000,
    liquidity: 180_000,
    closeTime: "2029-01-20T05:00:00Z",
    pairKey: "greenland-buy",
  },
  {
    id: "0xsnap-greenland-control",
    slug: "us-control-greenland",
    title: "Will the US take control of any part of Greenland before 2029?",
    subtitle: "Yes",
    category: "Politics",
    yes: 0.24,
    vol24: 41_000,
    volTotal: 2_900_000,
    liquidity: 150_000,
    closeTime: "2029-01-21T05:00:00Z",
    pairKey: "greenland-control",
  },
  // ---- Macro / crypto (fuzzy-matchable to Kalshi by title) ----
  {
    id: "0xsnap-fed-cut",
    slug: "fed-rate-cut-next-meeting",
    title: "Fed decreases interest rates at next meeting?",
    subtitle: "Yes",
    category: "Economics",
    yes: 0.54,
    vol24: 220_000,
    volTotal: 12_800_000,
    liquidity: 520_000,
    closeTime: "2026-07-29T18:00:00Z",
    pairKey: "fed-cut-next",
  },
  {
    id: "0xsnap-recession-2026",
    slug: "us-recession-2026",
    title: "US recession in 2026?",
    subtitle: "Yes",
    category: "Economics",
    yes: 0.31,
    vol24: 88_000,
    volTotal: 6_400_000,
    liquidity: 300_000,
    closeTime: "2026-12-31T05:00:00Z",
    pairKey: "recession-2026",
  },
  {
    id: "0xsnap-btc-150k",
    slug: "bitcoin-150k-2026",
    title: "Will Bitcoin reach $150,000 in 2026?",
    subtitle: "Yes",
    category: "Crypto",
    yes: 0.43,
    vol24: 310_000,
    volTotal: 18_200_000,
    liquidity: 690_000,
    closeTime: "2026-12-31T05:00:00Z",
    pairKey: "btc-150k-2026",
  },
  {
    id: "0xsnap-eth-6k",
    slug: "ethereum-6k-2026",
    title: "Will Ethereum reach $6,000 in 2026?",
    subtitle: "Yes",
    category: "Crypto",
    yes: 0.37,
    vol24: 142_000,
    volTotal: 7_900_000,
    liquidity: 360_000,
    closeTime: "2026-12-31T05:00:00Z",
  },
  // ---- Standalone color for the grid ----
  {
    id: "0xsnap-tpoy-2026",
    slug: "time-person-of-the-year-2026",
    title: "Time Person of the Year 2026",
    subtitle: "Donald Trump",
    category: "Culture",
    yes: 0.28,
    vol24: 64_000,
    volTotal: 2_100_000,
    liquidity: 120_000,
    closeTime: "2026-12-10T05:00:00Z",
  },
  {
    id: "0xsnap-gpt5-2026",
    slug: "openai-gpt5-2026",
    title: "Will OpenAI release GPT-5 in 2026?",
    subtitle: "Yes",
    category: "Tech",
    yes: 0.66,
    vol24: 73_000,
    volTotal: 3_300_000,
    liquidity: 170_000,
    closeTime: "2026-12-31T05:00:00Z",
  },
];

const WEB = "https://polymarket.com";

export const SNAPSHOT_PAIR_KEY_BY_ID: Record<string, string> = Object.fromEntries(
  SPECS.filter((s) => s.pairKey).map((s) => [`polymarket:${s.id}`, s.pairKey!])
);

function specToMarket(s: SnapSpec, nowIso: string): Market {
  return {
    id: `polymarket:${s.id}`,
    venue: "polymarket",
    nativeId: s.id,
    tokenIds: [`snap-${s.id}-yes`, `snap-${s.id}-no`],
    title: s.title,
    subtitle: s.subtitle,
    slug: s.slug,
    url: `${WEB}/event/${s.slug}`,
    category: s.category,
    contractType: "binary",
    outcomes: [
      { id: "yes", name: s.subtitle || "Yes", price: s.yes, bid: round(s.yes - 0.01), ask: round(s.yes + 0.01) },
      { id: "no", name: "No", price: round(1 - s.yes), bid: round(1 - s.yes - 0.01), ask: round(1 - s.yes + 0.01) },
    ],
    yesPrice: s.yes,
    bestBid: round(s.yes - 0.01),
    bestAsk: round(s.yes + 0.01),
    volume24h: s.vol24,
    volumeTotal: s.volTotal,
    liquidity: s.liquidity,
    openInterest: null,
    closeTime: s.closeTime,
    rules: "Snapshot (demo) market — illustrative data, not live.",
    mode: "snapshot",
    updatedAt: nowIso,
  };
}

const round = (n: number) => Math.max(0.01, Math.min(0.99, Math.round(n * 100) / 100));

export function getSnapshotMarkets(): Market[] {
  const nowIso = new Date().toISOString();
  return SPECS.map((s) => specToMarket(s, nowIso));
}

export function getSnapshotMarket(nativeId: string): Market | null {
  const s = SPECS.find((x) => x.id === nativeId);
  return s ? specToMarket(s, new Date().toISOString()) : null;
}

// ---- Deterministic synthetic history (stable per market id) ----
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n: number) => Math.max(0.01, Math.min(0.99, n));

function rangeBuckets(range: string): { start: number; n: number } {
  const now = Math.floor(Date.now() / 1000);
  switch (range) {
    case "1d":
      return { start: now - 86_400, n: 48 };
    case "1w":
      return { start: now - 7 * 86_400, n: 84 };
    case "1m":
      return { start: now - 30 * 86_400, n: 120 };
    case "3m":
      return { start: now - 90 * 86_400, n: 90 };
    case "all":
      return { start: now - 365 * 86_400, n: 180 };
    default:
      return { start: now - 7 * 86_400, n: 84 };
  }
}

export function getSnapshotHistory(nativeId: string, range = "1w"): PricePoint[] {
  const s = SPECS.find((x) => x.id === nativeId);
  if (!s) return [];
  const { start, n } = rangeBuckets(range);
  const end = Math.floor(Date.now() / 1000);
  const rng = mulberry32(hashSeed(nativeId + range));
  // random walk, then shift so the last point lands on the current price
  let p = clamp(s.yes + (rng() - 0.5) * 0.22);
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    raw.push(p);
    p = clamp(p + (rng() - 0.5) * 0.028);
  }
  const shift = s.yes - raw[n - 1];
  return raw.map((v, i) => ({
    t: start + Math.round((i / (n - 1)) * (end - start)),
    p: clamp(v + shift),
  }));
}
