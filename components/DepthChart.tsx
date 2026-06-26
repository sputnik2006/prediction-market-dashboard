"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { Orderbook } from "@/lib/types";
import { formatSize } from "@/lib/utils";

interface Pt {
  price: number; // percent 0..100
  bid: number | null; // cumulative bid depth
  ask: number | null; // cumulative ask depth
}

function DepthTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Pt | undefined;
  if (!p) return null;
  const isBid = p.bid != null;
  const depth = (p.bid ?? p.ask) ?? 0;
  return (
    <div className="rounded border border-border bg-surface-2 px-2 py-1 text-[11px] tabular">
      <div className="text-fg">{p.price.toFixed(1)}%</div>
      <div className={isBid ? "text-up" : "text-down"}>
        {isBid ? "bid" : "ask"} depth {formatSize(depth)}
      </div>
    </div>
  );
}

/**
 * Cumulative market-depth chart over the FULL 0–100% price range: bid depth
 * (green) accumulates downward from the best bid, ask depth (red) accumulates
 * upward from the best ask. Updates live with the order book.
 */
export function DepthChart({
  book,
  height = 150,
  loading = false,
}: {
  book: Orderbook | null | undefined;
  height?: number;
  loading?: boolean;
}) {
  const gid = useId();
  if (loading && !book) {
    return <div style={{ height }} className="skeleton rounded-lg" />;
  }
  if (!book || (!book.bids.length && !book.asks.length)) {
    return (
      <div
        style={{ height }}
        className="grid place-items-center rounded-lg border border-border bg-surface text-xs text-fg-subtle"
      >
        No depth data.
      </div>
    );
  }

  const bidsDesc = [...book.bids].sort((a, b) => b.price - a.price);
  let cb = 0;
  const bidPts: Pt[] = bidsDesc.map((l) => {
    cb += l.size;
    return { price: l.price * 100, bid: cb, ask: null };
  });

  const asksAsc = [...book.asks].sort((a, b) => a.price - b.price);
  let ca = 0;
  const askPts: Pt[] = asksAsc.map((l) => {
    ca += l.size;
    return { price: l.price * 100, ask: ca, bid: null };
  });

  const data = [...bidPts, ...askPts].sort((a, b) => a.price - b.price);

  return (
    <div
      style={{ height }}
      className="rounded-lg border border-border bg-surface px-1 pt-1"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`${gid}-bid`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id={`${gid}-ask`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="price"
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: "#5f6e8f" }}
            axisLine={{ stroke: "#243049" }}
            tickLine={false}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip content={<DepthTooltip />} />
          <Area
            type="stepAfter"
            dataKey="bid"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill={`url(#${gid}-bid)`}
            connectNulls={false}
            isAnimationActive={false}
            dot={false}
          />
          <Area
            type="stepBefore"
            dataKey="ask"
            stroke="#ef4444"
            strokeWidth={1.5}
            fill={`url(#${gid}-ask)`}
            connectNulls={false}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
