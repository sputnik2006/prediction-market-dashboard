import { config, HAS_POLYROUTER } from "@/lib/config";
import { fetchJson } from "@/lib/http";
import { fetchPolyrouterStatus } from "@/lib/polyrouter";
import { probePolymarket } from "@/lib/polymarket";
import { jsonOk } from "@/lib/server";
import { cacheSeconds } from "@/lib/config";
import type { VenueStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Last time the Kalshi ping succeeded. The data endpoints poll Kalshi hard
// (2s order book), so the status ping occasionally loses a connection under
// that contention even though Kalshi is fine — don't scream OFFLINE for a blip.
let lastKalshiOkTs = 0;
const KALSHI_GRACE_MS = 90_000;

async function pingKalshi(): Promise<VenueStatus> {
  const t = Date.now();
  try {
    await fetchJson(`${config.kalshi.baseUrl}/exchange/status`, {
      retries: 2,
      timeoutMs: 8000,
    });
    lastKalshiOkTs = Date.now();
    return { venue: "kalshi", mode: "live", ok: true, latencyMs: Date.now() - t, message: null };
  } catch (err) {
    // Transient blip while we had a recent good ping → still live (degraded).
    if (Date.now() - lastKalshiOkTs < KALSHI_GRACE_MS) {
      return { venue: "kalshi", mode: "live", ok: true, latencyMs: Date.now() - t, message: "transient" };
    }
    return {
      venue: "kalshi",
      mode: "unreachable",
      ok: false,
      latencyMs: Date.now() - t,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const [kalshi, polymarket, polyrouter] = await Promise.all([
    pingKalshi(),
    probePolymarket(),
    HAS_POLYROUTER ? fetchPolyrouterStatus() : Promise.resolve(null),
  ]);

  return jsonOk(
    {
      venues: [kalshi, polymarket],
      polyrouter,
      hasPolyrouterKey: HAS_POLYROUTER,
      updatedAt: new Date().toISOString(),
    },
    cacheSeconds.status
  );
}
