"use client";

import { usePairs } from "@/lib/hooks";
import { PairCard } from "./PairCard";
import { Skeleton } from "./ui";

export function PairsSpotlight({ limit = 6 }: { limit?: number }) {
  const { data, isLoading } = usePairs();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: limit }).map((_, i) => (
          <Skeleton key={i} className="h-[188px]" />
        ))}
      </div>
    );
  }

  const pairs = (data?.pairs ?? [])
    .filter((p) => p.polymarket && p.kalshi)
    .slice(0, limit);

  if (!pairs.length) {
    return <p className="text-sm text-fg-subtle">No cross-exchange pairs available right now.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pairs.map((p) => (
        <PairCard key={p.pairId} pair={p} />
      ))}
    </div>
  );
}
