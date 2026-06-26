import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (conditional + conflict resolution). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a probability (0..1) as a percentage string. */
export function formatPct(p: number | null | undefined, digits = 1): string {
  if (p == null || Number.isNaN(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

/**
 * Exact probability as a percent, up to `maxDecimals` but with trailing zeros
 * trimmed — so Kalshi's whole cents read "19%" while Polymarket's sub-cent
 * levels read "13.5%" / "13.55%" instead of all collapsing to "13%".
 */
export function formatProb(p: number | null | undefined, maxDecimals = 2): string {
  if (p == null || Number.isNaN(p)) return "—";
  let s = (p * 100).toFixed(maxDecimals);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return `${s}%`;
}

/** Exact-ish size: thousands separators, no fake compaction of order-book depth. */
export function formatSize(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1000) return Math.round(n).toLocaleString();
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(n < 10 ? 2 : 1);
}

/** Format a probability delta (0..1 difference) with sign. */
export function formatPctDelta(d: number | null | undefined, digits = 1): string {
  if (d == null || Number.isNaN(d)) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${(d * 100).toFixed(digits)} pts`;
}

/** Compact currency, e.g. $1.2M, $34.5K. */
export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Compact integer, e.g. 1.2M, 34.5K. */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

const ZONE_ABBR: Record<string, string> = {
  "Asia/Kolkata": "IST",
  "Asia/Calcutta": "IST",
  "Asia/Tokyo": "JST",
  "Asia/Singapore": "SGT",
  "Asia/Dubai": "GST",
  "Asia/Shanghai": "CST",
  "Australia/Sydney": "AEST",
  "Europe/London": "GMT",
};

/** Short label for the viewer's local timezone, e.g. "IST" or "GMT+5:30". */
export function tzShortLabel(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ZONE_ABBR[zone]) return ZONE_ABBR[zone];
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (name && name !== "GMT") return name;
  } catch {
    /* fall through */
  }
  const o = -new Date().getTimezoneOffset();
  const sign = o >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(o) / 60);
  const m = Math.abs(o) % 60;
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

/** Days until a future ISO date; negative if past. null if unparseable. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}
