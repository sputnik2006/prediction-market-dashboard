import type { Category } from "./types";

/**
 * Curated cross-exchange EVENT matches (spec §7 outcome alignment). A Polymarket
 * categorical event (N candidate markets) ↔ a Kalshi series (N binary markets).
 * We align every candidate by canonical entity, so the WHOLE field pairs — not
 * just the high-volume candidates a text matcher happens to see.
 *
 * Kalshi series + Polymarket event slugs verified live. Extend this list to add
 * coverage (other nominations, foreign elections, sports tournaments, …).
 */
export interface EventMatch {
  key: string;
  label: string;
  category: Category;
  polyEventSlug: string;
  kalshiSeries: string;
  matchBy: "person" | "team";
}

export const EVENT_MATCHES: EventMatch[] = [
  {
    key: "pres-2028",
    label: "2028 U.S. President",
    category: "Politics",
    polyEventSlug: "presidential-election-winner-2028",
    kalshiSeries: "KXPRESPERSON",
    matchBy: "person",
  },
  {
    key: "dem-nom-2028",
    label: "2028 Democratic Nominee",
    category: "Politics",
    polyEventSlug: "democratic-presidential-nominee-2028",
    kalshiSeries: "KXPRESNOMD",
    matchBy: "person",
  },
  {
    key: "rep-nom-2028",
    label: "2028 Republican Nominee",
    category: "Politics",
    polyEventSlug: "republican-presidential-nominee-2028",
    kalshiSeries: "KXPRESNOMR",
    matchBy: "person",
  },
];
