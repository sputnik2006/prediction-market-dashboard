"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, type MarketQuery } from "./api";
import type { Orderbook, Venue } from "./types";

export function useStatus() {
  return useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 20_000 });
}

export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: api.stats, refetchInterval: 30_000 });
}

/** Server-paged, filterable, sortable market browser with infinite scroll. */
export function useMarketsInfinite(params: Omit<MarketQuery, "offset">) {
  const limit = params.limit ?? 48;
  return useInfiniteQuery({
    queryKey: ["markets", params],
    queryFn: ({ pageParam }) => api.markets({ ...params, offset: pageParam, limit }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.limit < last.total ? last.offset + last.limit : undefined,
    refetchInterval: 60_000,
  });
}

export function usePairs() {
  return useQuery({ queryKey: ["pairs"], queryFn: api.pairs, refetchInterval: 20_000 });
}

export function useArb() {
  return useQuery({ queryKey: ["arb"], queryFn: api.arb, refetchInterval: 12_000 });
}

export function useHistory(refs: string[], range: string) {
  return useQuery({
    queryKey: ["history", [...refs].sort(), range],
    queryFn: () => api.history(refs, range),
    enabled: refs.length > 0,
    refetchInterval: 30_000,
  });
}

/** Fast live-price poll (~3s) used to push the chart tip + tiles + spread live. */
export function useQuote(refs: string[], intervalMs = 3000) {
  return useQuery({
    queryKey: ["quote", [...refs].sort()],
    queryFn: () => api.quote(refs),
    enabled: refs.length > 0,
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
  });
}

export function useOrderbook(venue: Venue | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ["orderbook", venue, id],
    queryFn: () => api.orderbook(venue as Venue, id as string),
    enabled: Boolean(venue && id),
    refetchInterval: 2_000, // moving book — re-poll fast (Kalshi gated by its own ~1.6s latency)
  });
}

/**
 * Live order book. Polymarket streams tick-by-tick over SSE (real WebSocket on
 * the server); Kalshi falls back to the 2s poll. Returns the same shape as
 * useOrderbook so callers are drop-in. SSE result overrides the poll once it
 * arrives; the poll still provides the instant first paint + a fallback.
 */
export function useLiveOrderbook(venue: Venue | undefined, id: string | undefined) {
  const poll = useOrderbook(venue, id);
  const [live, setLive] = useState<Orderbook | null>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    setLive(null);
    setStreaming(false);
    if (venue !== "polymarket" || !id || typeof window === "undefined") return;
    const es = new EventSource(`/api/stream/orderbook/polymarket/${encodeURIComponent(id)}`);
    es.onopen = () => setStreaming(true);
    es.onmessage = (e) => {
      try {
        setLive(JSON.parse(e.data) as Orderbook);
        setStreaming(true);
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => setStreaming(false); // EventSource auto-reconnects → onopen re-fires
    return () => es.close();
  }, [venue, id]);

  // While the stream is connected, use it (it pushes every change in real time —
  // a stable book legitimately just doesn't tick). Fall back to the 2s poll when
  // the stream isn't connected. Badge reflects "connected", not "ticked recently".
  const isLive = venue === "polymarket" && streaming && live != null;
  const data = isLive ? live : poll.data;
  return { data, isLoading: poll.isLoading && !data, isLive };
}

export function useMarket(venue: Venue | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ["market", venue, id],
    queryFn: () => api.market(venue as Venue, id as string),
    enabled: Boolean(venue && id),
    refetchInterval: 20_000,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: q.trim().length > 0,
  });
}
