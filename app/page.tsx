import Link from "next/link";
import { StatusBanner } from "@/components/StatusBanner";
import { StatsRow } from "@/components/StatsRow";
import { PairsSpotlight } from "@/components/PairsSpotlight";
import { ArbRadar } from "@/components/ArbRadar";
import { MarketGrid } from "@/components/MarketGrid";
import { Section } from "@/components/ui";

export default function Page() {
  return (
    <div className="space-y-9">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prediction Markets Dashboard</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Live odds, cross-exchange comparison, and order flow across Polymarket and Kalshi.
          </p>
        </div>
        <StatusBanner />
        <StatsRow />
      </div>

      <Section
        title="Cross-Exchange Spotlight"
        subtitle="The same real-world market priced on both venues — verified matches."
        action={
          <Link href="/compare" className="text-xs text-fg-muted hover:text-fg">
            Open comparison →
          </Link>
        }
      >
        <PairsSpotlight />
      </Section>

      <Section
        title="Arbitrage Radar"
        subtitle="Depth-aware: net profit after walking both order books and fees — not top-of-book."
      >
        <ArbRadar />
      </Section>

      <Section title="Markets" subtitle="Browse and filter every tracked market.">
        <MarketGrid />
      </Section>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-soft pt-5 text-xs text-fg-subtle">
      <p>
        Data:{" "}
        <a
          href="https://kalshi.com"
          target="_blank"
          rel="noreferrer"
          className="text-kalshi hover:underline"
        >
          Kalshi
        </a>{" "}
        (live) ·{" "}
        <a
          href="https://polymarket.com"
          target="_blank"
          rel="noreferrer"
          className="text-polymarket hover:underline"
        >
          Polymarket
        </a>{" "}
        (live where reachable, else labeled snapshot) · optional aggregation via{" "}
        <a
          href="https://docs.polyrouter.io"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          PolyRouter
        </a>
        . Probabilities are market-implied, not financial advice.
      </p>
    </footer>
  );
}
