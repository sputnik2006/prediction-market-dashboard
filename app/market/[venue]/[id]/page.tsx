import { MarketDetail } from "@/components/MarketDetail";
import type { Venue } from "@/lib/types";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ venue: string; id: string }>;
}) {
  const { venue, id } = await params;
  const v: Venue = venue === "kalshi" ? "kalshi" : "polymarket";
  return <MarketDetail venue={v} id={decodeURIComponent(id)} />;
}
