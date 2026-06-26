"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import type { PricePoint, Venue } from "@/lib/types";

const COLOR: Record<Venue, string> = {
  polymarket: "#4f8ff7",
  kalshi: "#19c39b",
};

export function Sparkline({
  points,
  venue,
  height = 38,
}: {
  points: PricePoint[];
  venue: Venue;
  height?: number;
}) {
  const gid = useId();
  if (!points || points.length < 2) {
    return <div style={{ height }} className="w-full" />;
  }
  const data = points.map((p) => ({ t: p.t, v: p.p * 100 }));
  const color = COLOR[venue];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gid})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
