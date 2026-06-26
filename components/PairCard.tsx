"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  ConfidenceBadge,
  ModeBadge,
  ProbabilityBar,
  VenueBadge,
  VENUE_LABEL,
} from "./ui";
import { formatProb } from "@/lib/utils";
import { divergenceFor } from "@/lib/divergence";
import { DivergenceFlag } from "./DivergencePanel";
import type { Market, MarketPair, Venue } from "@/lib/types";

function Side({ m, venue }: { m: Market | null; venue: Venue }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <VenueBadge venue={venue} />
          {m && <ModeBadge mode={m.mode} />}
        </div>
        <span className="tabular text-lg font-semibold leading-none">
          {m?.yesPrice != null ? formatProb(m.yesPrice) : "—"}
        </span>
      </div>
      <ProbabilityBar value={m?.yesPrice ?? null} venue={venue} />
    </div>
  );
}

export function PairCard({ pair }: { pair: MarketPair }) {
  const spreadLabel = pair.spread != null ? formatProb(pair.spread) : null;
  return (
    <Link href={`/compare?pair=${encodeURIComponent(pair.pairId)}`} className="block">
      <Card hover className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{pair.title}</p>
          <div className="flex shrink-0 items-center gap-1">
            {(() => {
              const d = divergenceFor(pair.pairId, pair.category);
              return d ? <DivergenceFlag status={d.status} /> : null;
            })()}
            <ConfidenceBadge confidence={pair.confidence} />
          </div>
        </div>

        <div className="space-y-2.5">
          <Side m={pair.polymarket} venue="polymarket" />
          <Side m={pair.kalshi} venue="kalshi" />
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border-soft pt-2.5 text-xs">
          <span className="text-fg-muted">
            Spread{" "}
            <span className="tabular font-semibold text-fg">{spreadLabel ?? "—"}</span>
          </span>
          {pair.cheaperVenue && pair.spread != null && pair.spread > 0.001 ? (
            <span className="flex items-center gap-1 text-fg-muted">
              cheaper on{" "}
              <span className="font-medium text-fg">{VENUE_LABEL[pair.cheaperVenue]}</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          ) : (
            <span className="text-fg-subtle">aligned</span>
          )}
        </div>
      </Card>
    </Link>
  );
}
