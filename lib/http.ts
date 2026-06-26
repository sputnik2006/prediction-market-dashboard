import { config } from "./config";

export class UpstreamError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.url = url;
  }
}

interface FetchOpts {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  /** Treat these statuses as "empty but ok" instead of throwing. */
  okEmptyStatuses?: number[];
  /** Optional undici dispatcher (e.g. the DoH agent) for this request. */
  dispatcher?: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Server-side JSON fetch with timeout + exponential backoff (jittered) on
 * 429/5xx/network errors. Deliberately sends NO `Origin` header — Kalshi 403s
 * the moment one is present, and we never want to leak the browser origin
 * upstream. Runs only in route handlers (Node runtime).
 */
export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const {
    timeoutMs = config.upstreamTimeoutMs,
    retries = 2,
    headers = {},
    okEmptyStatuses = [],
    dispatcher,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { accept: "application/json", ...headers },
        // Next.js: don't cache at the fetch layer; we set route-level cache headers.
        cache: "no-store",
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit & { dispatcher?: unknown });
      clearTimeout(timer);

      if (okEmptyStatuses.includes(res.status)) {
        return {} as T;
      }

      if (res.status === 429 || res.status >= 500) {
        // Retryable. Kalshi sends no Retry-After, so back off with jitter.
        throw new UpstreamError(
          `Upstream ${res.status}`,
          res.status,
          url
        );
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new UpstreamError(
          `Upstream ${res.status}: ${text.slice(0, 160)}`,
          res.status,
          url
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const retryable =
        err instanceof UpstreamError
          ? err.status === 429 || err.status >= 500
          : true; // network/abort errors are retryable
      if (attempt < retries && retryable) {
        const backoff = 250 * 2 ** attempt + Math.floor(Math.random() * 200);
        await sleep(backoff);
        continue;
      }
      break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Build a query string, skipping null/undefined values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** parseFloat that tolerates strings/nulls and returns null on failure. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
