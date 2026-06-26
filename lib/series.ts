import type { PricePoint, PriceSeries } from "./types";

/**
 * Grid step (seconds) per range. Chosen so a range spans ~100–1500 evenly-spaced
 * buckets — enough detail without overloading the axis.
 */
export function bucketSeconds(range: string): number {
  switch (range) {
    case "1d":
      return 60; // 1-minute
    case "1w":
      return 30 * 60; // 30-minute
    case "1m":
      return 3600; // 1-hour (matches Kalshi hourly candles — no downsampling)
    case "3m":
      return 6 * 3600; // 6-hour
    case "all":
      return 24 * 3600; // 1-day
    default:
      return 30 * 60;
  }
}

const MAX_BUCKETS = 2200;

/**
 * Resample irregular price points onto a SHARED uniform time grid, forward-filled
 * (a prediction-market price holds until it next changes).
 *
 * lightweight-charts lays points out by INDEX, not by real time — so feeding it
 * irregularly-spaced points produces a non-uniform, mislabeled time axis (and a
 * dense live-tip cluster collapses into duplicate minute labels). Putting every
 * series on the same evenly-spaced grid makes index ∝ time, so the axis is
 * uniform and correctly labeled. All series share identical bucket timestamps,
 * so their x-positions line up exactly.
 */
export function resampleSeries(
  series: PriceSeries[],
  range: string,
  nowTs: number
): PriceSeries[] {
  const step = bucketSeconds(range);

  let minT = Infinity;
  for (const s of series) for (const p of s.points) if (p.t < minT) minT = p.t;
  if (!Number.isFinite(minT)) return series; // no data anywhere

  let start = Math.floor(minT / step) * step;
  const end = Math.floor(nowTs / step) * step;
  if (end < start) return series;
  // keep the most recent buckets if the span is huge
  if ((end - start) / step + 1 > MAX_BUCKETS) start = end - (MAX_BUCKETS - 1) * step;

  return series.map((s) => {
    const pts = [...s.points].sort((a, b) => a.t - b.t);
    const out: PricePoint[] = [];
    let i = 0;
    let last: number | null = null;
    for (let bt = start; bt <= end; bt += step) {
      // carry forward the most recent observation at or before this bucket
      while (i < pts.length && pts[i].t <= bt) {
        last = pts[i].p;
        i++;
      }
      if (last != null) out.push({ t: bt, p: last });
    }
    return { ...s, points: out };
  });
}
