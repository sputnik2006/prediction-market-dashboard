import { SEED_PAIRS } from "./pairs.seed";
import { canonicalEntity } from "./entities";
import type { EventMatch } from "./events.seed";
import type { Market, MarketPair, Venue } from "./types";

// Kalshi taker fees are non-trivial; Polymarket is ~0. Use a flat probability
// buffer to keep "edge" honest and conservative.
const FEE_BUFFER = 0.01;
// Weighted-overlap score required to accept a fuzzy match.
const FUZZY_THRESHOLD = 0.6;
// A shared token appearing in ≤ this many markets counts as "distinctive"
// (a name/entity, not a common event word). At least one is required.
const DISTINCT_DF_CAP = 8;

const STOPWORDS = new Set([
  "will","the","a","an","of","to","in","on","at","by","for","be","is","are",
  "and","or","this","that","before","after","than","with","it","its","as",
  "us","u.s.","2024","market","yes","no","reach","hit","who","next",
]);

// Collapse plural/variant forms so e.g. nomination↔nominee, championship↔champion.
const STEMS: Record<string, string> = {
  championships: "champion",
  championship: "champion",
  champions: "champion",
  winner: "win",
  winning: "win",
  wins: "win",
  won: "win",
  presidential: "president",
  presidency: "president",
  nomination: "nominee",
  nominations: "nominee",
  nominees: "nominee",
  elections: "election",
  democratic: "democrat",
  democrats: "democrat",
  republicans: "republican",
};

// Expand a few high-value aliases so cross-venue naming differences still match
// (Polymarket "USA" vs Kalshi "United States", team city names, etc.).
const ALIASES: Record<string, string[]> = {
  usa: ["united", "states", "america"],
  us: ["united", "states"],
  uk: ["united", "kingdom", "britain"],
  uae: ["emirates"],
  gop: ["republican"],
  dem: ["democrat"],
  dems: ["democrat"],
  btc: ["bitcoin"],
  eth: ["ethereum"],
  sf: ["san", "francisco"],
  nyc: ["new", "york"],
  la: ["los", "angeles"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s$%.]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  const base = normalize(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => STEMS[t] ?? t);
  const out = new Set(base);
  for (const t of base) for (const a of ALIASES[t] ?? []) out.add(a);
  return [...out];
}

/** Numbers + 4-digit years present in a title — used as a guard rail. */
function numericTokens(s: string): string[] {
  return (s.match(/\$?\d[\d,.]*k?|\b(19|20)\d{2}\b/gi) ?? []).map((x) =>
    x.toLowerCase().replace(/[,$]/g, "")
  );
}

function fullText(m: Market): string {
  return `${m.title} ${m.subtitle ?? ""}`.trim();
}

/** Reject if the two titles contain conflicting numbers/years (≥25bps vs 50bps). */
function numbersConflict(a: Market, b: Market): boolean {
  const na = numericTokens(fullText(a));
  const nb = numericTokens(fullText(b));
  if (na.length === 0 || nb.length === 0) return false;
  const setB = new Set(nb);
  return !na.some((x) => setB.has(x));
}

/**
 * Coarse "what is being asked" tag. The same entity (a candidate) can appear in
 * a NOMINEE market, a WINNER market, and a "will they RUN" market — those are
 * NOT the same question and must never be matched together.
 */
function questionKind(m: Market): "nominee" | "run" | "winner" | "host" | null {
  const t = fullText(m).toLowerCase();
  // "host the World Cup" / "host the Olympics" is a different question from "win it"
  if (/\bhost(s|ed|ing)?\b/.test(t)) return "host";
  if (/\b(run for|running for|will run|runs for|candidacy|enter the race|drop out|withdraw)\b/.test(t))
    return "run";
  if (/\b(nominee|nomination|primary)\b/.test(t)) return "nominee";
  if (/\b(win|wins|winner|won|elected|presidency)\b/.test(t)) return "winner";
  return null;
}

function questionConflict(a: Market, b: Market): boolean {
  const ka = questionKind(a);
  const kb = questionKind(b);
  return ka != null && kb != null && ka !== kb;
}

/**
 * A combined "A, B or C" market (e.g. a 3-country World Cup *host* bid) must never
 * fuzzy-match a single-entity market — they're different questions even though they
 * share a name token.
 */
function isMultiEntity(m: Market): boolean {
  const s = (m.subtitle ?? "").trim();
  return /,/.test(s) && /\bor\b/i.test(s);
}

function computeSpread(poly: Market | null, kalshi: Market | null) {
  const p = poly?.yesPrice ?? null;
  const k = kalshi?.yesPrice ?? null;
  if (p == null || k == null) {
    return { spread: null, edge: null, cheaperVenue: null as Venue | null };
  }
  const spread = Math.abs(p - k);
  const edge = Math.max(0, spread - FEE_BUFFER);
  const cheaperVenue: Venue = p <= k ? "polymarket" : "kalshi";
  return { spread, edge, cheaperVenue };
}

function makePair(
  pairKey: string,
  title: string,
  poly: Market | null,
  kalshi: Market | null,
  confidence: MarketPair["confidence"],
  matchMethod: MarketPair["matchMethod"],
  notes: string | null
): MarketPair {
  const { spread, edge, cheaperVenue } = computeSpread(poly, kalshi);
  const category = poly?.category ?? kalshi?.category ?? "Other";
  return {
    pairId: pairKey,
    title,
    category,
    polymarket: poly,
    kalshi,
    confidence,
    matchMethod,
    spread,
    edge,
    cheaperVenue,
    notes,
  };
}

const TEAM_STOP = new Set(["the", "fc", "cf", "afc", "sc", "club"]);

/** Distinctive tokens of a team/club label (drops generic suffixes). */
function teamTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !TEAM_STOP.has(t))
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/**
 * Build cross-exchange pairs: curated seed first (verified), then fuzzy match
 * the remainder. The fuzzy matcher uses IDF-weighted token overlap so the rare
 * tokens that actually distinguish a market (candidate / team names) dominate
 * the score — not the common event words ("2028", "nominee") shared by every
 * candidate. Single-venue leftovers are NOT emitted here.
 */
export function buildPairs(
  kalshiMarkets: Market[],
  polyMarkets: Market[],
  eventInputs: { em: EventMatch; polyMarkets: Market[] }[] = []
): MarketPair[] {
  const kByTicker = new Map(kalshiMarkets.map((m) => [m.nativeId, m]));
  const pById = new Map(polyMarkets.map((m) => [m.nativeId, m]));
  const usedK = new Set<string>();
  const usedP = new Set<string>();
  const pairs: MarketPair[] = [];

  // 0) Event-level outcome alignment (spec §7): align every candidate of a
  // shared categorical event by canonical entity. Same event + same entity ⇒
  // resolution-equivalent, so these are high-confidence.
  for (const { em, polyMarkets: evPoly } of eventInputs) {
    const kInSeries = kalshiMarkets.filter((m) => m.seriesTicker === em.kalshiSeries);
    const kByEnt = new Map<string, Market>();
    for (const m of kInSeries) {
      const e = canonicalEntity(m.subtitle ?? "", em.matchBy);
      if (e && !kByEnt.has(e)) kByEnt.set(e, m);
    }
    // For teams, also keep token sets so "Sacramento" ↔ "Sacramento Kings" and
    // "Man Utd" ↔ "Manchester United" can align when the exact canonical doesn't.
    const kTok =
      em.matchBy === "team"
        ? kInSeries.map((m) => ({ m, toks: teamTokens(m.subtitle ?? "") }))
        : [];

    for (const p of evPoly) {
      if (usedP.has(p.nativeId)) continue;
      const e = canonicalEntity(p.subtitle ?? "", em.matchBy);
      let k = e ? kByEnt.get(e) : undefined;

      if ((!k || usedK.has(k.nativeId)) && em.matchBy === "team") {
        const pt = teamTokens(p.subtitle ?? "");
        if (pt.size) {
          let best: Market | undefined;
          let score = 0;
          for (const { m, toks } of kTok) {
            if (usedK.has(m.nativeId)) continue;
            const s = tokenOverlap(pt, toks);
            if (s > score) {
              score = s;
              best = m;
            }
          }
          if (best && score >= 1) k = best;
        }
      }

      if (!k || usedK.has(k.nativeId)) continue;
      const key = (e || k.subtitle || p.subtitle || "").toLowerCase().replace(/\s+/g, "-");
      usedP.add(p.nativeId);
      usedK.add(k.nativeId);
      pairs.push(
        makePair(
          `event:${em.key}:${key}`,
          `${em.label} — ${p.subtitle ?? k.subtitle ?? ""}`,
          p,
          k,
          "verified",
          "manual",
          null
        )
      );
    }
  }

  // 1) Curated seed → verified (skip anything event alignment already paired).
  for (const s of SEED_PAIRS) {
    const k = kByTicker.get(s.kalshiTicker) ?? null;
    const p =
      (s.polyConditionId ? pById.get(s.polyConditionId) : null) ??
      (s.polySnapshotId ? pById.get(s.polySnapshotId) : null) ??
      null;
    if (!k && !p) continue;
    if ((k && usedK.has(k.nativeId)) || (p && usedP.has(p.nativeId))) continue;
    if (k) usedK.add(k.nativeId);
    if (p) usedP.add(p.nativeId);
    pairs.push(
      makePair(
        s.pairKey,
        s.title,
        p,
        k,
        k && p ? "verified" : "unmatched",
        "manual",
        k && p ? null : "Only one venue available in this environment."
      )
    );
  }

  // 2) Fuzzy match the remainder.
  const remP = polyMarkets.filter((m) => !usedP.has(m.nativeId));
  const remK = kalshiMarkets.filter((m) => !usedK.has(m.nativeId));

  const pTokens = remP.map((m) => tokens(fullText(m)));
  const kTokens = remK.map((m) => tokens(fullText(m)));

  // Document frequency over the whole matching pool → idf weighting.
  const df = new Map<string, number>();
  for (const doc of [...pTokens, ...kTokens]) {
    for (const t of new Set(doc)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const nDocs = pTokens.length + kTokens.length || 1;
  const idf = (t: string) => Math.log(1 + nDocs / (df.get(t) ?? 1));

  // Inverted index for blocking (only score Kalshi markets sharing tokens).
  const index = new Map<string, number[]>();
  kTokens.forEach((doc, i) => {
    for (const t of new Set(doc)) {
      const bucket = index.get(t);
      if (bucket) bucket.push(i);
      else index.set(t, [i]);
    }
  });

  const weightOf = (toks: string[]) =>
    [...new Set(toks)].reduce((s, t) => s + idf(t), 0);

  function weightedScore(a: string[], b: string[]): number {
    const sb = new Set(b);
    let interW = 0;
    let shared = 0;
    let hasDistinct = false;
    for (const t of new Set(a)) {
      if (sb.has(t)) {
        interW += idf(t);
        shared++;
        if ((df.get(t) ?? 0) <= DISTINCT_DF_CAP) hasDistinct = true;
      }
    }
    if (shared < 2 || !hasDistinct) return 0;
    const denom = Math.min(weightOf(a), weightOf(b)) || 1;
    return interW / denom;
  }

  // Bound work: consider the most liquid Polymarket markets.
  const order = remP
    .map((_, i) => i)
    .sort((x, y) => (remP[y].volumeTotal ?? 0) - (remP[x].volumeTotal ?? 0))
    .slice(0, 600);

  for (const pi of order) {
    const p = remP[pi];
    if (usedP.has(p.nativeId)) continue;
    const pt = pTokens[pi];

    const shared = new Map<number, number>();
    for (const t of new Set(pt)) {
      const ids = index.get(t);
      if (!ids) continue;
      for (const ki of ids) shared.set(ki, (shared.get(ki) ?? 0) + 1);
    }
    const candidates = [...shared.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([ki]) => ki);

    let best: { ki: number; score: number } | null = null;
    for (const ki of candidates) {
      const k = remK[ki];
      if (usedK.has(k.nativeId)) continue;
      if (p.category !== k.category) continue;
      if (numbersConflict(p, k)) continue;
      if (questionConflict(p, k)) continue;
      if (isMultiEntity(p) || isMultiEntity(k)) continue;
      const score = weightedScore(pt, kTokens[ki]);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
        best = { ki, score };
      }
    }
    if (best) {
      const k = remK[best.ki];
      const pair = makePair(
        `fuzzy:${p.nativeId}:${k.nativeId}`,
        p.title,
        p,
        k,
        "fuzzy",
        "fuzzy",
        `Auto-matched (${(best.score * 100).toFixed(0)}% weighted token overlap). Verify resolution rules before treating any spread as an edge.`
      );
      // A huge spread on an unverified match almost always means the titles
      // collided but the markets differ — drop it.
      if (pair.spread != null && pair.spread > 0.35) continue;
      usedK.add(k.nativeId);
      usedP.add(p.nativeId);
      pairs.push(pair);
    }
  }

  // Sort: verified first, then by spread (biggest divergence on top).
  const rank = { verified: 0, fuzzy: 1, unmatched: 2 } as const;
  pairs.sort((a, b) => {
    if (rank[a.confidence] !== rank[b.confidence]) return rank[a.confidence] - rank[b.confidence];
    return (b.spread ?? -1) - (a.spread ?? -1);
  });
  return pairs;
}
