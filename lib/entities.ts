// Entity canonicalization (spec §3.1) — collapse surface-form differences so the
// SAME person/team/country aligns across venues. A light, dependency-free alias
// table (Wikidata linking would be the production upgrade).

function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/^yes\s+/, "")
    .replace(/["'.,]/g, "")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PERSON_ALIASES: Record<string, string> = {
  aoc: "alexandria ocasio cortez",
  rfk: "robert f kennedy",
  "rfk jr": "robert f kennedy",
  "bobby kennedy": "robert f kennedy",
  "robert kennedy": "robert f kennedy",
  djt: "donald trump",
  "donald j trump": "donald trump",
  "donald trump jr": "donald trump jr", // keep distinct from DJT
  mtg: "marjorie taylor greene",
  "j d vance": "jd vance",
  "pete buttigieg": "pete buttigieg",
};

/** Canonical key for a person name (candidate). */
export function canonicalPerson(name: string): string {
  let s = clean(name);
  if (PERSON_ALIASES[s]) return PERSON_ALIASES[s];
  // strip generational suffixes unless it's the alias-distinguished "trump jr"
  if (s !== "donald trump jr") {
    s = s.replace(/\b(jr|sr|ii|iii)\b/g, "").replace(/\s+/g, " ").trim();
  }
  return PERSON_ALIASES[s] ?? s;
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states",
  us: "united states",
  uk: "united kingdom",
  "south korea": "south korea",
  "congo dr": "dr congo",
  "ivory coast": "cote divoire",
};

/** Canonical key for a country/team name. */
export function canonicalTeam(name: string): string {
  const s = clean(name);
  return COUNTRY_ALIASES[s] ?? s;
}

export function canonicalEntity(name: string, kind: "person" | "team"): string {
  return kind === "team" ? canonicalTeam(name) : canonicalPerson(name);
}
