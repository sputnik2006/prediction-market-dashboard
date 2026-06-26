"use client";

import Link from "next/link";
import { Card, ModeBadge, ProbabilityBar, VenueBadge } from "./ui";
import { formatCompact, formatProb, daysUntil } from "@/lib/utils";
import type { Market } from "@/lib/types";

function closeLabel(iso: string | null): string {
  const d = daysUntil(iso);
  if (d == null) return "—";
  if (d < 0) return "closed";
  if (d === 0) return "today";
  if (d < 45) return `${d}d left`;
  if (d < 600) return `${Math.round(d / 30)}mo left`;
  return `${Math.round(d / 365)}y left`;
}

export function MarketCard({ market }: { market: Market }) {
  const yes = market.yesPrice;
  return (
    <Link
      href={`/market/${market.venue}/${encodeURIComponent(market.nativeId)}`}
      className="block"
    >
      <Card hover className="flex h-full flex-col gap-3 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <VenueBadge venue={market.venue} />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-fg-subtle">
              {market.category}
            </span>
            <ModeBadge mode={market.mode} />
          </div>
        </div>

        <div className="min-h-[40px]">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-fg">
            {market.title}
          </p>
          {market.subtitle && market.subtitle !== market.title && (
            <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">{market.subtitle}</p>
          )}
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-end justify-between">
            <span className="text-[11px] uppercase tracking-wide text-fg-subtle">Yes</span>
            <span className="tabular text-2xl font-semibold leading-none">
              {formatProb(yes)}
            </span>
          </div>
          <ProbabilityBar value={yes} venue={market.venue} />
          <div className="flex items-center justify-between text-[11px] text-fg-subtle">
            <span>Vol {formatCompact(market.volumeTotal)}</span>
            <span>{closeLabel(market.closeTime)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
