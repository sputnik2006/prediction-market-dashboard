"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useMarketsInfinite, useStats } from "@/lib/hooks";
import { ALL_CATEGORIES } from "@/lib/category";
import { MarketCard } from "./MarketCard";
import { Pill, SegmentedControl, Skeleton, Spinner } from "./ui";
import type { Category, MarketSort, Venue } from "@/lib/types";

type VenueFilter = "" | Venue;

const SORTS: { label: string; value: MarketSort }[] = [
  { label: "Most active (24h)", value: "volume24h" },
  { label: "Top volume", value: "volume" },
  { label: "Closing soon", value: "closing" },
  { label: "Highest %", value: "price" },
];

export function MarketGrid() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [venue, setVenue] = useState<VenueFilter>("");
  const [sort, setSort] = useState<MarketSort>("volume24h");

  // Debounce the search box so each keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const stats = useStats();
  const cats = useMemo(() => {
    const counts = stats.data?.byCategory ?? {};
    return ALL_CATEGORIES.filter((c) => counts[c]);
  }, [stats.data]);

  const query = useMarketsInfinite({ q, category, venue, sort, limit: 48 });
  const markets = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.markets),
    [query.data]
  );
  const total = query.data?.pages?.[0]?.total ?? 0;

  // Infinite scroll sentinel.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "700px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search any market on either venue…"
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as MarketSort)}
            className="rounded-lg border border-border bg-surface px-2.5 py-[7px] text-xs text-fg-muted focus:border-accent/50 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <SegmentedControl
            value={venue}
            onChange={setVenue}
            options={[
              { label: "All", value: "" },
              { label: "Polymarket", value: "polymarket" },
              { label: "Kalshi", value: "kalshi" },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill active={category === ""} onClick={() => setCategory("")}>
          All
        </Pill>
        {cats.map((c) => (
          <Pill key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}{" "}
            <span className="text-fg-subtle">{stats.data?.byCategory[c]}</span>
          </Pill>
        ))}
      </div>

      <div className="text-xs text-fg-subtle">
        {query.isLoading
          ? "Loading…"
          : `${total.toLocaleString()} market${total === 1 ? "" : "s"}${
              q ? ` matching “${q}”` : ""
            }`}
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px]" />
          ))}
        </div>
      ) : markets.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
          <div ref={sentinel} className="flex justify-center py-5">
            {isFetchingNextPage ? (
              <Spinner />
            ) : hasNextPage ? (
              <span className="text-xs text-fg-subtle">Scroll for more…</span>
            ) : (
              <span className="text-xs text-fg-subtle">End of results</span>
            )}
          </div>
        </>
      ) : (
        <p className="py-10 text-center text-sm text-fg-subtle">
          No markets match your filters.
        </p>
      )}
    </div>
  );
}
