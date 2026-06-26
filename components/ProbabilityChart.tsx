"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { PriceSeries } from "@/lib/types";

const COLOR: Record<string, string> = {
  polymarket: "#4f8ff7",
  kalshi: "#19c39b",
};

// Exact percent — no rounding. Trailing zeros trimmed: 19.7 → "19.7%".
const fmtPct = (p: number): string => `${p.toFixed(2).replace(/\.?0+$/, "")}%`;

/**
 * Dual-line probability chart.
 *
 * `series` arrives already resampled onto a SHARED uniform time grid (see
 * lib/series.ts) — that's what keeps the (index-based) time axis uniform and
 * correctly labeled. History is drawn once per range/refetch with setData; the
 * live quote is snapped to the current grid bucket and pushed with series.update
 * (~3s) so only the tip moves — never a full redraw, and no point clustering.
 */
export function ProbabilityChart({
  series,
  live,
  gridSec = 1800,
  height = 340,
  resetKey,
  tz = "local",
}: {
  series: PriceSeries[];
  /** venue → current probability 0–1, snapped to the grid as a live tip. */
  live?: Record<string, number | null>;
  /** grid step (seconds) the series were resampled onto. */
  gridSec?: number;
  height?: number;
  resetKey?: string;
  tz?: "local" | "utc";
}) {
  // lightweight-charts labels times as UTC; pre-shift by the local offset so the
  // axis reads in the chosen timezone. A constant shift keeps spacing uniform.
  const offset = tz === "utc" ? 0 : -new Date().getTimezoneOffset() * 60;

  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const linesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const lastTimeRef = useRef<Map<string, number>>(new Map());
  const lastReset = useRef<string | undefined>(undefined);

  // Create the chart once.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height,
      width: el.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3c4",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(36,48,73,0.30)" },
        horzLines: { color: "rgba(36,48,73,0.30)" },
      },
      rightPriceScale: {
        borderColor: "#243049",
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "#243049",
        timeVisible: true,
        secondsVisible: false,
        // Pin the latest data to the right edge: pan left into history, never
        // scroll past "now" into empty future.
        fixRightEdge: true,
        rightOffset: 0,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#5f6e8f", labelBackgroundColor: "#182032" },
        horzLine: { color: "#5f6e8f", labelBackgroundColor: "#182032" },
      },
      localization: { priceFormatter: fmtPct },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: false },
      },
      kineticScroll: { mouse: true, touch: true },
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (elRef.current) chart.applyOptions({ width: elRef.current.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      linesRef.current.clear();
      lastTimeRef.current.clear();
      lastReset.current = undefined;
    };
  }, [height]);

  // History data — setData on range/market change or the ~30s refetch.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const present = new Set(series.map((s) => s.venue));
    for (const [venue, line] of linesRef.current) {
      if (!present.has(venue as PriceSeries["venue"])) {
        chart.removeSeries(line);
        linesRef.current.delete(venue);
        lastTimeRef.current.delete(venue);
      }
    }

    for (const s of series) {
      let line = linesRef.current.get(s.venue);
      if (!line) {
        line = chart.addLineSeries({
          color: COLOR[s.venue] ?? "#a78bfa",
          lineWidth: 2,
          priceLineVisible: true,
          priceLineStyle: LineStyle.Solid,
          priceLineWidth: 1,
          lastValueVisible: true,
          lineStyle: s.mode === "snapshot" ? LineStyle.Dashed : LineStyle.Solid,
          priceFormat: { type: "custom", minMove: 0.01, formatter: fmtPct },
        });
        linesRef.current.set(s.venue, line);
      }
      // grid is already unique + ascending; map to chart units (shifted by offset)
      const data = s.points.map((pt) => ({
        time: (pt.t + offset) as Time,
        value: pt.p * 100,
      }));
      line.setData(data);
      if (data.length) lastTimeRef.current.set(s.venue, data[data.length - 1].time as number);
    }

    if (resetKey !== lastReset.current) {
      chart.timeScale().fitContent();
      lastReset.current = resetKey;
    }
  }, [series, resetKey, offset]);

  // Live tip — snap the quote to the current grid bucket and update in place.
  useEffect(() => {
    if (!chartRef.current || !live) return;
    const nowBucket = Math.floor(Date.now() / 1000 / gridSec) * gridSec + offset;
    for (const [venue, line] of linesRef.current) {
      const v = live[venue];
      if (v == null) continue;
      const lastT = lastTimeRef.current.get(venue);
      if (lastT != null && nowBucket < lastT) continue; // never go backward
      line.update({ time: nowBucket as Time, value: v * 100 });
      lastTimeRef.current.set(venue, nowBucket);
    }
  }, [live, offset, gridSec]);

  return <div ref={elRef} style={{ height }} className="w-full" />;
}
