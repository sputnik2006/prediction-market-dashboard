"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { useStatus } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { ModeBadge, VenueDot, VENUE_LABEL } from "./ui";
import type { Venue } from "@/lib/types";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/compare", label: "Cross-Exchange" },
];

export function Header() {
  const pathname = usePathname();
  const { data } = useStatus();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-polymarket to-kalshi text-bg">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Prediction<span className="text-fg-muted">Markets</span>
          </span>
          <span className="hidden text-[11px] text-fg-subtle sm:inline">
            Polymarket × Kalshi
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active ? "bg-surface-2 text-fg" : "text-fg-subtle hover:text-fg"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {data?.venues.map((v) => (
            <div
              key={v.venue}
              className="hidden items-center gap-1.5 text-[11px] text-fg-muted md:flex"
              title={v.message ?? `${VENUE_LABEL[v.venue as Venue]}: ${v.mode}`}
            >
              <VenueDot venue={v.venue as Venue} />
              <span>{VENUE_LABEL[v.venue as Venue]}</span>
              <ModeBadge mode={v.mode} />
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
