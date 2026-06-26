"use client";

import Link from "next/link";
import { usePairs } from "@/lib/hooks";
import { ConfidenceBadge, Skeleton } from "./ui";
import { cn, formatProb } from "@/lib/utils";

export function SpreadTable() {
  const { data, isLoading } = usePairs();
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const pairs = [...(data?.pairs ?? [])]
    .filter((p) => p.spread != null)
    .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0));

  if (!pairs.length)
    return <p className="text-sm text-fg-subtle">No matched pairs to compare yet.</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Market</th>
              <th className="px-3 py-2 text-right font-medium">Polymarket</th>
              <th className="px-3 py-2 text-right font-medium">Kalshi</th>
              <th className="px-3 py-2 text-right font-medium">Spread</th>
              <th className="px-3 py-2 text-right font-medium">Edge*</th>
              <th className="px-3 py-2 text-left font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => {
              const actionable = p.confidence === "verified" && (p.edge ?? 0) > 0;
              return (
                <tr key={p.pairId} className="border-t border-border-soft hover:bg-surface-2/50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/compare?pair=${encodeURIComponent(p.pairId)}`}
                      className="text-fg-muted hover:text-fg"
                    >
                      <span className="line-clamp-1">{p.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {formatProb(p.polymarket?.yesPrice ?? null)}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {formatProb(p.kalshi?.yesPrice ?? null)}
                  </td>
                  <td className="px-3 py-2 text-right tabular font-semibold">
                    {formatProb(p.spread)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular",
                      actionable ? "font-semibold text-up" : "text-fg-subtle"
                    )}
                  >
                    {actionable ? formatProb(p.edge) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <ConfidenceBadge confidence={p.confidence} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border-soft bg-surface px-3 py-2 text-[11px] leading-relaxed text-fg-subtle">
        *Fee-adjusted edge is shown only for verified matches with positive edge. Fuzzy and
        snapshot rows are illustrative — always confirm both venues&rsquo; resolution rules before
        treating a spread as a real arbitrage.
      </p>
    </div>
  );
}
