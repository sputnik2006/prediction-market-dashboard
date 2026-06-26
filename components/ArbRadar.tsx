"use client";

import Link from "next/link";
import { useArb } from "@/lib/hooks";
import { ConfidenceBadge, Skeleton, VENUE_LABEL } from "./ui";
import { DivergenceFlag } from "./DivergencePanel";
import { divergenceFor } from "@/lib/divergence";
import { RISK_FREE_RATE } from "@/lib/arb";
import { cn, formatMoney, formatProb, formatSize } from "@/lib/utils";

export function ArbRadar() {
  const { data, isLoading } = useArb();
  if (isLoading) return <Skeleton className="h-56 w-full" />;

  const rows = data?.rows ?? [];
  if (!rows.length)
    return <p className="text-sm text-fg-subtle">No matched pairs to scan.</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Market</th>
              <th className="px-3 py-2 text-right font-medium">Polymarket</th>
              <th className="px-3 py-2 text-right font-medium">Kalshi</th>
              <th className="px-3 py-2 text-right font-medium">Spread</th>
              <th className="px-3 py-2 text-right font-medium">Net profit*</th>
              <th className="px-3 py-2 text-right font-medium">Fillable</th>
              <th className="px-3 py-2 text-right font-medium">ROI (ann.)</th>
              <th className="px-3 py-2 text-left font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = r.arb;
              return (
                <tr key={r.pairId} className="border-t border-border-soft hover:bg-surface-2/50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/compare?pair=${encodeURIComponent(r.pairId)}`}
                      className="text-fg-muted hover:text-fg"
                    >
                      <span className="line-clamp-1">{r.title}</span>
                    </Link>
                    {a.hasArb && a.buyVenue && (
                      <span className="text-[11px] text-fg-subtle">
                        buy YES on{" "}
                        <span className="text-fg-muted">{VENUE_LABEL[a.buyVenue]}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular">{formatProb(r.polyYes)}</td>
                  <td className="px-3 py-2 text-right tabular">{formatProb(r.kalshiYes)}</td>
                  <td className="px-3 py-2 text-right tabular font-medium text-warn">
                    {formatProb(Math.abs((r.polyYes ?? 0) - (r.kalshiYes ?? 0)))}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular",
                      a.hasArb ? "font-semibold text-up" : "text-fg-subtle"
                    )}
                  >
                    {a.hasArb ? formatMoney(a.netProfit) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-fg-muted">
                    {a.hasArb ? formatSize(a.fillableSize) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {a.hasArb ? (
                      <>
                        <span className="text-fg-muted">{(a.roi * 100).toFixed(1)}%</span>
                        {a.annualizedRoi != null && (
                          <span
                            className={cn(
                              "ml-1",
                              a.annualizedRoi >= RISK_FREE_RATE ? "text-up" : "text-warn"
                            )}
                            title={
                              a.annualizedRoi >= RISK_FREE_RATE
                                ? `Beats the ~${(RISK_FREE_RATE * 100).toFixed(0)}%/yr risk-free rate`
                                : `Below the ~${(RISK_FREE_RATE * 100).toFixed(0)}%/yr risk-free rate — a T-bill beats it`
                            }
                          >
                            ({(a.annualizedRoi * 100).toFixed(1)}/yr)
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge confidence={r.confidence} />
                      {(() => {
                        const d = divergenceFor(r.pairId, r.category);
                        return d ? <DivergenceFlag status={d.status} /> : null;
                      })()}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border-soft bg-surface px-3 py-2 text-[11px] leading-relaxed text-fg-subtle">
        Sorted by cross-exchange <span className="text-warn">spread</span>. *Net profit is
        depth-aware — after walking BOTH order books and applying Kalshi fees, not top-of-book.
        ROI is on locked capital, annualized by time-to-resolution: a real arb must clear the
        ~{(RISK_FREE_RATE * 100).toFixed(0)}%/yr <span className="text-warn">risk-free rate</span>{" "}
        (amber = below it, so a T-bill beats it — a spread, not an edge). Resolution differences
        flagged per row; verify the rules.
      </p>
    </div>
  );
}
