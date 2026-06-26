"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatProb, formatSize } from "@/lib/utils";
import type { Orderbook, OrderbookLevel } from "@/lib/types";

export function OrderbookDepth({
  book,
  levels = 50,
  loading = false,
}: {
  book: Orderbook | null | undefined;
  levels?: number;
  loading?: boolean;
}) {
  if (loading && !book) return <div className="skeleton h-[200px] rounded-lg" />;
  if (!book)
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-xs text-fg-subtle">
        No order book.
      </div>
    );

  const bids = book.bids.slice(0, levels);
  const asks = book.asks.slice(0, levels);
  const maxSize = Math.max(
    1,
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size)
  );

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border-soft text-xs">
      <Column side="bid" rows={bids} total={book.bids.length} maxSize={maxSize} />
      <Column side="ask" rows={asks} total={book.asks.length} maxSize={maxSize} />
    </div>
  );
}

function Column({
  side,
  rows,
  total,
  maxSize,
}: {
  side: "bid" | "ask";
  rows: OrderbookLevel[];
  total: number;
  maxSize: number;
}) {
  const isBid = side === "bid";
  return (
    <div className="bg-surface">
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between bg-surface px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-fg-subtle",
          !isBid && "flex-row-reverse"
        )}
      >
        <span>{isBid ? "Yes bids" : "Yes asks"}</span>
        <span className="normal-case text-fg-subtle/70">{total} lvls</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {rows.length ? (
          // keyed by price so each level is a stable row that grows/shrinks/flashes
          rows.map((l) => (
            <Row key={l.price} side={side} price={l.price} size={l.size} maxSize={maxSize} />
          ))
        ) : (
          <div className={cn("px-3 py-2 text-fg-subtle", !isBid && "text-right")}>—</div>
        )}
      </div>
    </div>
  );
}

function Row({
  side,
  price,
  size,
  maxSize,
}: {
  side: "bid" | "ask";
  price: number;
  size: number;
  maxSize: number;
}) {
  // Flash the row green/red when this level's size changes between polls.
  const prev = useRef(size);
  const [flash, setFlash] = useState<"" | "up" | "down">("");
  useEffect(() => {
    if (prev.current !== size) {
      setFlash(size > prev.current ? "up" : "down");
      prev.current = size;
      const t = setTimeout(() => setFlash(""), 450);
      return () => clearTimeout(t);
    }
  }, [size]);

  const w = `${(size / maxSize) * 100}%`;
  const isBid = side === "bid";
  return (
    <div
      className={cn(
        "relative flex items-center justify-between px-3 py-1 tabular transition-colors duration-300",
        flash === "up" && "bg-up/20",
        flash === "down" && "bg-down/20"
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 transition-[width] duration-500 ease-out",
          isBid ? "left-0 bg-up/10" : "right-0 bg-down/10"
        )}
        style={{ width: w }}
      />
      {isBid ? (
        <>
          <span className="relative text-up">{formatProb(price)}</span>
          <span className="relative text-fg-muted">{formatSize(size)}</span>
        </>
      ) : (
        <>
          <span className="relative text-fg-muted">{formatSize(size)}</span>
          <span className="relative text-down">{formatProb(price)}</span>
        </>
      )}
    </div>
  );
}
