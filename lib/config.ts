// Centralized, env-overridable configuration.
// Upstream hosts are overridable so a user behind a DNS/network block can point
// Polymarket at a reachable mirror/proxy without code changes.

export const config = {
  kalshi: {
    baseUrl:
      process.env.KALSHI_BASE_URL ??
      "https://api.elections.kalshi.com/trade-api/v2",
    web: "https://kalshi.com",
  },
  polymarket: {
    gammaUrl: process.env.POLY_GAMMA_URL ?? "https://gamma-api.polymarket.com",
    clobUrl: process.env.POLY_CLOB_URL ?? "https://clob.polymarket.com",
    web: "https://polymarket.com",
  },
  polyrouter: {
    baseUrl:
      process.env.POLYROUTER_BASE_URL ?? "https://api.polyrouter.io/functions/v1",
    apiKey: process.env.POLYROUTER_API_KEY ?? "",
  },
  /** Upstream request timeout (ms). */
  upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 12_000),
  /**
   * DNS-over-HTTPS for Polymarket, for networks that DNS-block polymarket.com
   * (e.g. India). "auto" = try direct, fall back to DoH on a DNS error;
   * "on" = always DoH; "off" = never. Default "auto" (no-op where DNS works).
   */
  polyDoh: (process.env.POLY_DOH ?? "auto") as "auto" | "on" | "off",
  /**
   * When Polymarket's direct host is unreachable (e.g. corporate DNS block) and
   * no PolyRouter key is set, serve a clearly-labeled snapshot so the
   * cross-exchange UI stays functional. Set POLY_SNAPSHOT=off to disable.
   */
  polySnapshotEnabled: (process.env.POLY_SNAPSHOT ?? "on") !== "off",
} as const;

export const HAS_POLYROUTER = config.polyrouter.apiKey.length > 0;

/** s-maxage cache hints (seconds) per route, balancing freshness vs rate limits. */
export const cacheSeconds = {
  markets: 30,
  market: 15,
  history: 60,
  orderbook: 1,
  pairs: 30,
  search: 60,
  status: 15,
} as const;
