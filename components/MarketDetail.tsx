"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useHistory, useMarket, useLiveOrderbook, useQuote } from "@/lib/hooks";
import { ProbabilityChart } from "./ProbabilityChart";
import { OrderbookDepth } from "./OrderbookDepth";
import { DepthChart } from "./DepthChart";
import { Card, LiveTick, ModeBadge, SegmentedControl, Skeleton, Stat, VenueBadge } from "./ui";
import { formatCompact, formatProb, daysUntil, tzShortLabel } from "@/lib/utils";
import type { Venue } from "@/lib/types";

const RANGES = [
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "All", value: "all" },
];

function closeText(iso: string | null): string {
  if (!iso) return "—";
  const d = daysUntil(iso);
  const date = new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (d == null) return date;
  if (d < 0) return `${date} (closed)`;
  return `${date} · ${d}d`;
}

export function MarketDetail({ venue, id }: { venue: Venue; id: string }) {
  const [range, setRange] = useState("1d");
  const [tz, setTz] = useState<"local" | "utc">("local");
  const ref = `${venue}:${id}`;
  const market = useMarket(venue, id);
  const history = useHistory([ref], range);
  const quote = useQuote([ref]);
  const book = useLiveOrderbook(venue, id);

  const q = quote.data?.quotes[ref];
  const baseSeries = history.data?.series ?? [];
  const live = useMemo(
    () => ({ [venue]: q?.yes ?? null }),
    [venue, q?.yes]
  );

  if (market.isLoading) {
    return <Skeleton className="h-[520px] w-full" />;
  }
  const m = market.data;
  if (!m) {
    return (
      <Card className="grid h-64 place-items-center text-sm text-fg-subtle">
        Market not found.
      </Card>
    );
  }

  const liveYes = q?.yes ?? m.yesPrice;
  const liveBid = q?.bid ?? m.bestBid;
  const liveAsk = q?.ask ?? m.bestAsk;

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <VenueBadge venue={m.venue} />
            <ModeBadge mode={m.mode} />
            <span className="text-[11px] uppercase tracking-wide text-fg-subtle">
              {m.category}
            </span>
          </div>
          <h1 className="max-w-3xl text-lg font-semibold leading-snug">{m.title}</h1>
          {m.subtitle && m.subtitle !== m.title && (
            <p className="text-sm text-fg-muted">{m.subtitle}</p>
          )}
        </div>
        <a
          href={m.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg"
        >
          View on {m.venue === "kalshi" ? "Kalshi" : "Polymarket"}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Yes" value={formatProb(liveYes)} accent="text-fg" />
        <Stat label="Bid / Ask" value={`${formatProb(liveBid)} / ${formatProb(liveAsk)}`} />
        <Stat label="Volume" value={formatCompact(m.volumeTotal)} sub="all-time" />
        <Stat label="24h Volume" value={formatCompact(m.volume24h)} />
        <Stat label="Closes" value={closeText(m.closeTime)} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Probability history
          </h2>
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={tz}
              onChange={setTz}
              options={[
                { label: tzShortLabel(), value: "local" },
                { label: "UTC", value: "utc" },
              ]}
              size="sm"
            />
            <SegmentedControl value={range} onChange={setRange} options={RANGES} size="sm" />
          </div>
        </div>
        <div className="mt-3">
          {history.isLoading ? (
            <Skeleton className="h-[340px] w-full" />
          ) : baseSeries.some((s) => s.points.length > 1) ? (
            <ProbabilityChart
              series={baseSeries}
              live={live}
              gridSec={history.data?.gridSeconds}
              resetKey={`${ref}:${range}`}
              tz={tz}
            />
          ) : (
            <div className="grid h-[340px] place-items-center text-sm text-fg-subtle">
              No price history for this range.
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-end text-xs">
          <LiveTick />
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Order book &amp; depth
          </h2>
          <DepthChart book={book.data} height={170} loading={book.isLoading} />
          <OrderbookDepth book={book.data} loading={book.isLoading} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Resolution
          </h2>
          <Card className="p-4">
            <p className="whitespace-pre-line text-xs leading-relaxed text-fg-muted">
              {m.rules?.trim() || "No resolution text available for this market."}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
