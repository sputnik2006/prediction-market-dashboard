"use client";

import { useState } from "react";
import { usePairs } from "@/lib/hooks";
import { PairCard } from "./PairCard";
import { Skeleton } from "./ui";
import { PairFilterBar, distinctCategories, type SortOption } from "./PairFilterBar";
import type { MarketPair } from "@/lib/types";

const SORTS: SortOption[] = [
  { value: "spread", label: "Spread" },
  { value: "volume", label: "Volume" },
  { value: "closing", label: "Closing soon" },
];

const vol = (p: MarketPair) =>
  Math.max(p.polymarket?.volumeTotal ?? p.polymarket?.volume24h ?? 0, p.kalshi?.volumeTotal ?? 0);
const closeAt = (p: MarketPair) => {
  const t = p.kalshi?.closeTime ?? p.polymarket?.closeTime;
  return t ? new Date(t).getTime() : Infinity;
};

export function PairsSpotlight({ limit = 6 }: { limit?: number }) {
  const { data, isLoading } = usePairs();
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("spread");

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: limit }).map((_, i) => (
          <Skeleton key={i} className="h-[188px]" />
        ))}
      </div>
    );
  }

  const all = (data?.pairs ?? []).filter((p) => p.polymarket && p.kalshi);
  if (!all.length) {
    return <p className="text-sm text-fg-subtle">No cross-exchange pairs available right now.</p>;
  }

  const categories = distinctCategories(all);
  const filtered = category ? all.filter((p) => p.category === category) : all;
  const shown = [...filtered]
    .sort((a, b) =>
      sort === "volume"
        ? vol(b) - vol(a)
        : sort === "closing"
          ? closeAt(a) - closeAt(b)
          : (b.spread ?? 0) - (a.spread ?? 0)
    )
    .slice(0, limit);

  return (
    <div className="space-y-3">
      <PairFilterBar
        category={category}
        onCategory={setCategory}
        categories={categories}
        sort={sort}
        onSort={setSort}
        sortOptions={SORTS}
      />
      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <PairCard key={p.pairId} pair={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-fg-subtle">No pairs in this category.</p>
      )}
    </div>
  );
}
