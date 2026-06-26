"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useHistory, useLiveOrderbook, usePairs, useQuote } from "@/lib/hooks";
import { ProbabilityChart } from "./ProbabilityChart";
import { OrderbookDepth } from "./OrderbookDepth";
import { DepthChart } from "./DepthChart";
import { ArbPanel } from "./ArbPanel";
import { DivergencePanel, DivergenceFlag } from "./DivergencePanel";
import { computeArb } from "@/lib/arb";
import { divergenceFor } from "@/lib/divergence";
import {
  Card,
  ConfidenceBadge,
  LiveTick,
  ModeBadge,
  SegmentedControl,
  Skeleton,
  VenueBadge,
  VENUE_LABEL,
} from "./ui";
import { cn, formatProb, tzShortLabel } from "@/lib/utils";
import type { Market, MarketPair, Quote, Venue } from "@/lib/types";

const RANGES = [
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "All", value: "all" },
];

export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, isLoading } = usePairs();
  const [range, setRange] = useState("1d");
  const [picked, setPicked] = useState<string | null>(null);

  const pairs = data?.pairs ?? [];
  const both = pairs.filter((p) => p.polymarket && p.kalshi);
  const selectedId = picked ?? params.get("pair") ?? both[0]?.pairId ?? null;
  const sel = pairs.find((p) => p.pairId === selectedId) ?? both[0] ?? null;

  function choose(id: string) {
    setPicked(id);
    router.replace(`/compare?pair=${encodeURIComponent(id)}`, { scroll: false });
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[520px] lg:col-span-1" />
        <Skeleton className="h-[520px] lg:col-span-2" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <aside className="space-y-2 lg:col-span-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Matched pairs
        </h2>
        <div className="space-y-1.5">
          {pairs
            .filter((p) => p.spread != null)
            .map((p) => (
              <PairRow
                key={p.pairId}
                pair={p}
                active={p.pairId === selectedId}
                onClick={() => choose(p.pairId)}
              />
            ))}
        </div>
      </aside>

      <div className="lg:col-span-2">
        {sel ? (
          <PairDetail pair={sel} range={range} setRange={setRange} />
        ) : (
          <Card className="grid h-64 place-items-center text-sm text-fg-subtle">
            No comparable pairs.
          </Card>
        )}
      </div>
    </div>
  );
}

function PairRow({
  pair,
  active,
  onClick,
}: {
  pair: MarketPair;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-accent/50 bg-surface-2"
          : "border-border bg-surface hover:border-fg-subtle/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="line-clamp-1 text-xs font-medium text-fg">{pair.title}</span>
        <div className="flex shrink-0 items-center gap-1">
          {(() => {
            const d = divergenceFor(pair.pairId, pair.category);
            return d ? <DivergenceFlag status={d.status} /> : null;
          })()}
          <ConfidenceBadge confidence={pair.confidence} />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-fg-muted">
        <span className="tabular">
          <span className="text-polymarket">{formatProb(pair.polymarket?.yesPrice ?? null)}</span>
          {" / "}
          <span className="text-kalshi">{formatProb(pair.kalshi?.yesPrice ?? null)}</span>
        </span>
        <span className="tabular">Δ {formatProb(pair.spread)}</span>
      </div>
    </button>
  );
}

function PairDetail({
  pair,
  range,
  setRange,
}: {
  pair: MarketPair;
  range: string;
  setRange: (r: string) => void;
}) {
  const [tz, setTz] = useState<"local" | "utc">("local");

  const refs = useMemo(() => {
    const r: string[] = [];
    if (pair.polymarket) r.push(`polymarket:${pair.polymarket.nativeId}`);
    if (pair.kalshi) r.push(`kalshi:${pair.kalshi.nativeId}`);
    return r;
  }, [pair]);

  const history = useHistory(refs, range);
  const quote = useQuote(refs);
  const polyBook = useLiveOrderbook("polymarket", pair.polymarket?.nativeId);
  const kalshiBook = useLiveOrderbook("kalshi", pair.kalshi?.nativeId);

  const baseSeries = history.data?.series ?? [];

  const polyQ = pair.polymarket
    ? quote.data?.quotes[`polymarket:${pair.polymarket.nativeId}`]
    : undefined;
  const kalshiQ = pair.kalshi
    ? quote.data?.quotes[`kalshi:${pair.kalshi.nativeId}`]
    : undefined;
  const polyYes = polyQ?.yes ?? pair.polymarket?.yesPrice ?? null;
  const kalshiYes = kalshiQ?.yes ?? pair.kalshi?.yesPrice ?? null;

  // Live tip values per venue (pushed via series.update, no full re-render).
  const live = useMemo(
    () => ({ polymarket: polyQ?.yes ?? null, kalshi: kalshiQ?.yes ?? null }),
    [polyQ?.yes, kalshiQ?.yes]
  );

  const liveSpread =
    polyYes != null && kalshiYes != null ? Math.abs(polyYes - kalshiYes) : pair.spread;
  const cheaper: Venue | null =
    polyYes != null && kalshiYes != null
      ? polyYes <= kalshiYes
        ? "polymarket"
        : "kalshi"
      : pair.cheaperVenue;
  const liveEdge = liveSpread != null ? Math.max(0, liveSpread - 0.01) : pair.edge;
  const actionable = pair.confidence === "verified" && (liveEdge ?? 0) > 0;

  const closeTime = pair.kalshi?.closeTime ?? pair.polymarket?.closeTime;
  const arb = useMemo(
    () => computeArb(polyBook.data, kalshiBook.data, closeTime),
    [polyBook.data, kalshiBook.data, closeTime]
  );
  const divergence = divergenceFor(pair.pairId, pair.category);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{pair.title}</h2>
              <ConfidenceBadge confidence={pair.confidence} />
            </div>
            <p className="mt-0.5 text-xs text-fg-subtle">{pair.category}</p>
          </div>
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

        <div className="mt-4">
          {history.isLoading ? (
            <Skeleton className="h-[340px] w-full" />
          ) : baseSeries.some((s) => s.points.length > 1) ? (
            <ProbabilityChart
              series={baseSeries}
              live={live}
              gridSec={history.data?.gridSeconds}
              resetKey={`${pair.pairId}:${range}`}
              tz={tz}
            />
          ) : (
            <div className="grid h-[340px] place-items-center text-sm text-fg-subtle">
              No price history available for this range.
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
          <Legend venue="polymarket" />
          <Legend venue="kalshi" />
          <LiveTick />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <PriceTile which="polymarket" market={pair.polymarket} quote={polyQ} />
        <PriceTile which="kalshi" market={pair.kalshi} quote={kalshiQ} />
        <Card className="p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
            Spread / Edge
          </div>
          <div className="mt-1 text-2xl font-semibold tabular text-warn">
            {formatProb(liveSpread)}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
            {cheaper && liveSpread ? (
              <>
                buy Yes on
                <span className="font-medium text-fg">{VENUE_LABEL[cheaper]}</span>
                <ArrowRight className="h-3 w-3" />
                <span className={cn("tabular", actionable ? "text-up" : "text-fg-subtle")}>
                  {actionable ? `${formatProb(liveEdge)} edge` : "no net edge"}
                </span>
              </>
            ) : (
              "aligned"
            )}
          </div>
        </Card>
      </div>

      <ArbPanel arb={arb} closeTime={closeTime} divergence={divergence} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <VenueBadge venue="polymarket" />
            {pair.polymarket && <ModeBadge mode={pair.polymarket.mode} />}
            <span className="text-xs text-fg-subtle">order book</span>
            {polyBook.isLive && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-up">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />
                live · ws
              </span>
            )}
          </div>
          <DepthChart book={polyBook.data} loading={polyBook.isLoading} />
          <OrderbookDepth book={polyBook.data} loading={polyBook.isLoading} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <VenueBadge venue="kalshi" />
            {pair.kalshi && <ModeBadge mode={pair.kalshi.mode} />}
            <span className="text-xs text-fg-subtle">order book</span>
          </div>
          <DepthChart book={kalshiBook.data} loading={kalshiBook.isLoading} />
          <OrderbookDepth book={kalshiBook.data} loading={kalshiBook.isLoading} />
        </div>
      </div>

      <DivergencePanel divergence={divergence} />

      <div className="grid gap-3 sm:grid-cols-2">
        <RulesCard venue="Polymarket" rules={pair.polymarket?.rules} url={pair.polymarket?.url} />
        <RulesCard venue="Kalshi" rules={pair.kalshi?.rules} url={pair.kalshi?.url} />
      </div>
    </div>
  );
}

function Legend({ venue }: { venue: "polymarket" | "kalshi" }) {
  const color = venue === "polymarket" ? "bg-polymarket" : "bg-kalshi";
  return (
    <span className="flex items-center gap-1.5 text-fg-muted">
      <span className={cn("inline-block h-0.5 w-4 rounded", color)} />
      {VENUE_LABEL[venue]}
    </span>
  );
}

function PriceTile({
  which,
  market,
  quote,
}: {
  which: "polymarket" | "kalshi";
  market: Market | null;
  quote?: Quote;
}) {
  const yes = quote?.yes ?? market?.yesPrice ?? null;
  const bid = quote?.bid ?? market?.bestBid ?? null;
  const ask = quote?.ask ?? market?.bestAsk ?? null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <VenueBadge venue={which} />
        {market && <ModeBadge mode={market.mode} />}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular">{formatProb(yes)}</div>
      <div className="mt-0.5 text-xs text-fg-subtle">
        {market
          ? `Yes · bid ${formatProb(bid)} / ask ${formatProb(ask)}`
          : "unavailable"}
      </div>
    </Card>
  );
}

function RulesCard({
  venue,
  rules,
  url,
}: {
  venue: string;
  rules?: string;
  url?: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-muted">{venue} resolution</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-fg-subtle hover:text-fg"
          >
            open ↗
          </a>
        )}
      </div>
      <p className="line-clamp-6 text-xs leading-relaxed text-fg-muted">
        {rules?.trim() || "No resolution text available."}
      </p>
    </Card>
  );
}
