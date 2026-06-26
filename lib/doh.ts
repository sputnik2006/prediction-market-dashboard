import { Agent } from "undici";

/**
 * DNS-over-HTTPS resolver for upstreams whose hostnames are DNS-blocked on the
 * local network (e.g. Polymarket is DNS-banned in India, but the servers and
 * their TLS/SNI are reachable). We resolve A records via a DoH endpoint
 * (Cloudflare by default) and hand undici a custom `lookup`, so `fetch` connects
 * straight to the IP with the correct SNI. No VPN/proxy required.
 */

const DOH_URL = process.env.DOH_RESOLVER ?? "https://cloudflare-dns.com/dns-query";

interface Cached {
  ips: string[];
  expires: number;
}
const cache = new Map<string, Cached>();

async function resolveDoh(hostname: string): Promise<string[]> {
  const hit = cache.get(hostname);
  if (hit && hit.expires > Date.now()) return hit.ips;

  const res = await fetch(
    `${DOH_URL}?name=${encodeURIComponent(hostname)}&type=A`,
    { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`DoH ${res.status}`);
  const data = (await res.json()) as {
    Answer?: { type: number; data: string; TTL?: number }[];
  };
  const answers = data.Answer ?? [];
  const ips = answers.filter((a) => a.type === 1).map((a) => a.data);
  if (!ips.length) throw new Error(`DoH: no A record for ${hostname}`);
  const ttl = Math.min(900, Math.max(60, answers[0]?.TTL ?? 300));
  cache.set(hostname, { ips, expires: Date.now() + ttl * 1000 });
  return ips;
}

type LookupCb = (
  err: NodeJS.ErrnoException | null,
  address?: string | { address: string; family: number }[],
  family?: number
) => void;

/** Pass as `dispatcher` to fetch to route a request through DoH resolution. */
export const dohAgent = new Agent({
  connect: {
    // matches dns.lookup semantics; undici calls with { all?: boolean }
    lookup: (hostname: string, options: { all?: boolean }, callback: LookupCb) => {
      resolveDoh(hostname)
        .then((ips) => {
          if (options?.all) {
            callback(null, ips.map((address) => ({ address, family: 4 })));
          } else {
            callback(null, ips[0], 4);
          }
        })
        .catch((err) => callback(err as NodeJS.ErrnoException));
    },
  } as never,
});

/** True if an error looks like a DNS-resolution failure (so DoH can be tried). */
export function isDnsError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  const code = e?.code ?? e?.cause?.code;
  if (code && ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ESERVFAIL"].includes(code)) {
    return true;
  }
  const hay = `${e?.message ?? ""} ${e?.cause?.code ?? ""}`;
  return /ENOTFOUND|EAI_AGAIN|getaddrinfo|ECONNREFUSED|ServFail|dns/i.test(hay);
}
