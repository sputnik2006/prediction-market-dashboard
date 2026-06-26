"use client";

import { ArrowRight, AlertTriangle } from "lucide-react";
import { Card, VENUE_LABEL } from "./ui";
import { cn, daysUntil, formatMoney, formatSize } from "@/lib/utils";
import type { ArbResult, Divergence } from "@/lib/types";

function Header() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
        Fillable arbitrage
      </span>
      <span className="rounded bg-up/10 px-1.5 py-0.5 text-[10px] font-medium text-up">
        depth-aware
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-fg-subtle">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular", accent)}>{value}</div>
      {sub && <div className="text-[11px] text-fg-subtle">{sub}</div>}
    </div>
  );
}

export function ArbPanel({
  arb,
  closeTime,
  divergence,
}: {
  arb: ArbResult;
  closeTime?: string | null;
  divergence?: Divergence | null;
}) {
  if (!arb.hasArb) {
    return (
      <Card className="p-4">
        <Header />
        <p className="mt-2 text-sm text-fg-muted">
          No fillable arbitrage — the cheaper venue&rsquo;s ask doesn&rsquo;t clear the
          other&rsquo;s bid after fees.
        </p>
      </Card>
    );
  }

  const days = daysUntil(closeTime);

  return (
    <Card className="p-4">
      <Header />
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-fg-muted">Buy YES on</span>
        <span className="font-medium text-polymarket">
          {arb.buyVenue && VENUE_LABEL[arb.buyVenue]}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" />
        <span className="text-fg-muted">hedge (buy NO) on</span>
        <span className="font-medium text-kalshi">
          {arb.sellVenue && VENUE_LABEL[arb.sellVenue]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Fillable size" value={formatSize(arb.fillableSize)} sub="contracts" />
        <Metric
          label="Net profit"
          value={formatMoney(arb.netProfit)}
          sub={`on ${formatMoney(arb.capital)} capital`}
          accent="text-up"
        />
        <Metric
          label="ROI"
          value={`${(arb.roi * 100).toFixed(1)}%`}
          sub={
            arb.annualizedRoi != null
              ? `${(arb.annualizedRoi * 100).toFixed(1)}%/yr`
              : undefined
          }
          accent="text-up"
        />
        <Metric
          label="Edge / share"
          value={`${(arb.avgEdge * 100).toFixed(2)}¢`}
          sub={`touch ${(arb.bestEdge * 100).toFixed(2)}¢`}
        />
      </div>

      {divergence && divergence.status !== "equivalent" && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded border border-down/30 bg-down/10 px-2 py-1.5 text-[11px] leading-relaxed text-fg-muted">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-down" />
          <span>
            <span className="font-medium text-down">Not a clean lock — </span>
            resolutions {divergence.status === "divergent" ? "diverge" : "differ"} across venues.{" "}
            {divergence.worstCase}
          </span>
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
        Walks both order books until the edge collapses (Kalshi taker fees applied).
        {days != null && days > 0 ? ` Capital locked until resolution (~${days}d).` : ""}
      </p>
    </Card>
  );
}
