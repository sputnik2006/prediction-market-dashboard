"use client";

import { useStats, usePairs } from "@/lib/hooks";
import { Skeleton, Stat } from "./ui";
import { formatCompact, formatProb } from "@/lib/utils";

export function StatsRow() {
  const stats = useStats();
  const pairs = usePairs();

  if (stats.isLoading || pairs.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
    );
  }

  const s = stats.data;
  const venues = s?.venues ?? [];
  const ps = pairs.data?.pairs ?? [];
  const liveCount = venues.filter((v) => v.mode === "live").length;
  const verified = ps.filter((p) => p.confidence === "verified");
  const widest = ps.reduce(
    (best, p) => (p.spread != null && p.spread > (best?.spread ?? -1) ? p : best),
    null as (typeof ps)[number] | null
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Markets tracked"
        value={formatCompact(s?.totalMarkets ?? 0)}
        sub={`${s?.perVenue.kalshi ?? 0} Kalshi · ${s?.perVenue.polymarket ?? 0} Polymarket`}
      />
      <Stat
        label="24h volume"
        value={formatCompact(s?.vol24Total ?? 0)}
        sub={`${liveCount}/${venues.length} venues live`}
      />
      <Stat
        label="Cross-exchange pairs"
        value={ps.length}
        sub={`${verified.length} verified`}
        accent="text-aggregate"
      />
      <Stat
        label="Widest spread"
        value={widest?.spread != null ? formatProb(widest.spread) : "—"}
        sub={widest ? widest.title.slice(0, 32) : "no matched pairs"}
        accent="text-warn"
      />
    </div>
  );
}
