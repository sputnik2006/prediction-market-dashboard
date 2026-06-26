"use client";

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "./ui";
import { cn } from "@/lib/utils";
import type { Divergence, DivergenceStatus } from "@/lib/types";

const META: Record<
  DivergenceStatus,
  { label: string; text: string; Icon: typeof CheckCircle2 }
> = {
  equivalent: { label: "Resolutions equivalent", text: "text-up", Icon: CheckCircle2 },
  minor: { label: "Minor resolution differences", text: "text-warn", Icon: AlertCircle },
  divergent: { label: "Resolution divergence", text: "text-down", Icon: AlertTriangle },
};

/** Full resolution-equivalence panel for the comparison view. */
export function DivergencePanel({ divergence }: { divergence: Divergence | null }) {
  if (!divergence) return null;
  const m = META[divergence.status];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <m.Icon className={cn("h-4 w-4", m.text)} />
        <span className="text-sm font-medium">{m.label}</span>
        <span className="text-[11px] text-fg-subtle">
          {(divergence.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{divergence.reasoning}</p>
      {divergence.divergenceCases.length > 0 && (
        <ul className="mt-2 space-y-1">
          {divergence.divergenceCases.map((c, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] text-fg-muted">
              <span className="text-fg-subtle">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
      {divergence.status !== "equivalent" && divergence.worstCase && (
        <p className="mt-2.5 rounded border border-down/30 bg-down/10 px-2 py-1.5 text-[11px] leading-relaxed text-fg-muted">
          <span className="font-medium text-down">Arb risk: </span>
          {divergence.worstCase}
        </p>
      )}
    </Card>
  );
}

/** Compact flag for cards / tables. */
export function DivergenceFlag({ status }: { status: DivergenceStatus }) {
  if (status === "equivalent") return null;
  const cls = status === "divergent" ? "text-down ring-down/30" : "text-warn ring-warn/30";
  return (
    <span
      title="Resolution rules differ across venues — see the comparison page"
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ring-inset",
        cls
      )}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {status === "divergent" ? "diverges" : "rules"}
    </span>
  );
}
