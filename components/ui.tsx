"use client";

import type { ReactNode } from "react";
import { cn, formatProb } from "@/lib/utils";
import type { DataMode, MatchConfidence, Venue } from "@/lib/types";

export const VENUE_LABEL: Record<Venue, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
};
const VENUE_TEXT: Record<Venue, string> = {
  polymarket: "text-polymarket",
  kalshi: "text-kalshi",
};
const VENUE_BG: Record<Venue, string> = {
  polymarket: "bg-polymarket",
  kalshi: "bg-kalshi",
};
const VENUE_RING: Record<Venue, string> = {
  polymarket: "ring-polymarket/30",
  kalshi: "ring-kalshi/30",
};

export function Card({
  className,
  children,
  hover = false,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface",
        hover && "transition-colors hover:border-fg-subtle/40 hover:bg-surface-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function VenueDot({ venue, className }: { venue: Venue; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", VENUE_BG[venue], className)} />;
}

export function VenueBadge({ venue }: { venue: Venue }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        VENUE_RING[venue],
        "bg-surface-2"
      )}
    >
      <VenueDot venue={venue} />
      <span className={VENUE_TEXT[venue]}>{VENUE_LABEL[venue]}</span>
    </span>
  );
}

export function ModeBadge({ mode }: { mode: DataMode }) {
  if (mode === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-up ring-1 ring-inset ring-up/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-up" />
        </span>
        Live
      </span>
    );
  }
  if (mode === "snapshot") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn ring-1 ring-inset ring-warn/30">
        Snapshot
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-down ring-1 ring-inset ring-down/30">
      Offline
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  const map: Record<MatchConfidence, { label: string; cls: string }> = {
    verified: { label: "Verified match", cls: "text-up ring-up/30" },
    fuzzy: { label: "Fuzzy match", cls: "text-warn ring-warn/30" },
    unmatched: { label: "Single venue", cls: "text-fg-subtle ring-border" },
  };
  const { label, cls } = map[confidence];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset",
        cls
      )}
    >
      {label}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular", accent)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fg-muted">{sub}</div>}
    </Card>
  );
}

export function ProbabilityBar({
  value,
  venue,
  className,
}: {
  value: number | null;
  venue?: Venue;
  className?: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value * 100));
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-full", venue ? VENUE_BG[venue] : "bg-aggregate")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-fg-muted",
        className
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
            value === o.value
              ? "bg-surface-2 text-fg shadow-sm ring-1 ring-inset ring-border"
              : "text-fg-subtle hover:text-fg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "border-accent/50 bg-accent/15 text-fg"
          : "border-border bg-surface text-fg-muted hover:text-fg hover:border-border"
      )}
    >
      {children}
    </button>
  );
}

export function ProbabilityText({ value, className }: { value: number | null; className?: string }) {
  return <span className={cn("tabular font-semibold", className)}>{formatProb(value)}</span>;
}

/** Small pulsing "live" indicator. */
export function LiveTick({ label = "live · updates ~3s" }: { label?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-fg-subtle">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-up" />
      </span>
      {label}
    </span>
  );
}
