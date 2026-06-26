import type { Category } from "./types";

const CRYPTO_RE =
  /\b(bitcoin|btc|ethereum|eth\b|crypto|solana|\bsol\b|dogecoin|xrp|ripple|stablecoin|altcoin)\b/i;

/** Map a venue's raw category string (+ title hints) to a canonical Category. */
export function toCanonicalCategory(raw: string | null | undefined, title = ""): Category {
  const hay = `${raw ?? ""} ${title}`;
  if (CRYPTO_RE.test(hay)) return "Crypto";

  const r = (raw ?? "").toLowerCase().trim();

  if (/elect|politic|congress|senate|president|government|geopolit/.test(r)) return "Politics";
  if (/econ|financ|fed|inflation|rate|gdp|jobs|company|companies|business/.test(r)) return "Economics";
  if (/sport|nfl|nba|mlb|nhl|soccer|football|tennis|golf|ufc/.test(r)) return "Sports";
  if (/world|climate|weather|geo|war|ukraine|middle east|foreign/.test(r)) return "World";
  if (/tech|science|ai\b|space|crypto/.test(r)) return "Tech";
  if (/entertain|social|culture|pop|celebrity|music|movie|award|tv/.test(r)) return "Culture";

  // Title-based fallback
  const t = title.toLowerCase();
  if (/\b(election|president|senate|congress|trump|biden|democrat|republican)\b/.test(t))
    return "Politics";
  if (/\b(fed|inflation|gdp|recession|rate cut|interest rate|jobs report)\b/.test(t))
    return "Economics";
  if (/\b(nfl|nba|mlb|nhl|super bowl|world cup|champions|playoff)\b/.test(t)) return "Sports";

  return "Other";
}

export const ALL_CATEGORIES: Category[] = [
  "Politics",
  "Economics",
  "Crypto",
  "Sports",
  "World",
  "Tech",
  "Culture",
  "Other",
];
