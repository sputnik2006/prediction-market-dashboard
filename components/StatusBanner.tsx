"use client";

import { Info } from "lucide-react";
import { useStatus } from "@/lib/hooks";

/**
 * Transparency banner: shown when Polymarket is being served from the labeled
 * snapshot (e.g. its host is DNS-blocked on this network). Explains how to get
 * live data. Renders nothing when both venues are live.
 */
export function StatusBanner() {
  const { data } = useStatus();
  const poly = data?.venues.find((v) => v.venue === "polymarket");
  if (!poly || poly.mode === "live") return null;

  return (
    <div className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-xs">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <div className="space-y-1 text-fg-muted">
          <p className="font-medium text-fg">
            Polymarket is showing a labeled <span className="text-warn">snapshot</span>, not live
            data.
          </p>
          <p>
            The live Polymarket host (<code className="text-fg-subtle">polymarket.com</code>) is
            unreachable from this network — most likely a corporate DNS block. Kalshi is live.
            To get live Polymarket prices, run the app on a network where{" "}
            <code className="text-fg-subtle">gamma-api.polymarket.com</code> resolves, set{" "}
            <code className="text-fg-subtle">POLY_GAMMA_URL</code> to a reachable proxy, or add a{" "}
            <code className="text-fg-subtle">POLYROUTER_API_KEY</code>. The cross-exchange views
            below stay fully functional using the snapshot.
          </p>
        </div>
      </div>
    </div>
  );
}
