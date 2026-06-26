import WebSocket from "ws";
import type { Orderbook, OrderbookLevel } from "./types";

/**
 * Server-side Polymarket order-book WebSocket manager.
 *
 * Polymarket's CLOB WSS is public but DNS-blocked here, so we connect to a
 * DoH-resolved IP with SNI + Host set to the real host (same trick as the
 * DoH fetches). One persistent connection per token maintains the live book
 * (full `book` snapshot + `price_change` deltas) and fans out to SSE subscribers.
 * Reconnects on drop. Kalshi has no equivalent here (its WS needs API auth).
 */

const WS_HOST = "ws-subscriptions-clob.polymarket.com";
const DOH = "https://cloudflare-dns.com/dns-query";

type Sub = (book: Orderbook) => void;

interface Conn {
  ws: WebSocket | null;
  bids: Map<string, number>; // price string -> size
  asks: Map<string, number>;
  subs: Set<Sub>;
  marketId: string;
  closed: boolean;
  reconnect?: ReturnType<typeof setTimeout>;
}

const conns = new Map<string, Conn>(); // token -> Conn
let ipCache: { ip: string; exp: number } | null = null;

async function resolveWsIp(): Promise<string | null> {
  if (ipCache && ipCache.exp > Date.now()) return ipCache.ip;
  try {
    const r = await fetch(`${DOH}?name=${WS_HOST}&type=A`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
    });
    const ans = (await r.json())?.Answer?.filter((x: { type: number }) => x.type === 1);
    const ip = ans?.[0]?.data;
    if (ip) {
      ipCache = { ip, exp: Date.now() + 300_000 };
      return ip;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function snapshot(c: Conn): Orderbook {
  const toLevels = (m: Map<string, number>, desc: boolean): OrderbookLevel[] =>
    [...m.entries()]
      .map(([p, s]) => ({ price: Number(p), size: s }))
      .filter((l) => l.size > 0 && Number.isFinite(l.price))
      .sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
  return {
    venue: "polymarket",
    marketId: c.marketId,
    bids: toLevels(c.bids, true),
    asks: toLevels(c.asks, false),
    mode: "live",
    updatedAt: new Date().toISOString(),
  };
}

function emit(c: Conn) {
  const book = snapshot(c);
  for (const s of c.subs) {
    try {
      s(book);
    } catch {
      /* ignore one bad subscriber */
    }
  }
}

async function connect(token: string, c: Conn) {
  if (c.closed) return;
  const ip = await resolveWsIp();
  if (!ip || c.closed) {
    scheduleReconnect(token, c);
    return;
  }
  let ws: WebSocket;
  try {
    // servername (SNI) + Host route the IP connection to the real host; it's a
    // valid tls option but absent from the ws ClientOptions type, hence the cast.
    ws = new WebSocket(`wss://${ip}/ws/market`, {
      servername: WS_HOST,
      headers: { Host: WS_HOST },
    } as WebSocket.ClientOptions);
  } catch {
    scheduleReconnect(token, c);
    return;
  }
  c.ws = ws;

  ws.on("open", () => {
    try {
      ws.send(JSON.stringify({ type: "market", assets_ids: [token] }));
    } catch {
      /* ignore */
    }
  });

  ws.on("message", (d: WebSocket.RawData) => {
    let arr: unknown;
    try {
      arr = JSON.parse(d.toString());
    } catch {
      return;
    }
    const msgs = Array.isArray(arr) ? arr : [arr];
    for (const m of msgs as Array<Record<string, unknown>>) {
      if (m.event_type === "book") {
        // single-token subscription → this snapshot is ours
        c.bids.clear();
        c.asks.clear();
        for (const l of (m.bids as Array<{ price: string; size: string }>) ?? [])
          c.bids.set(l.price, Number(l.size));
        for (const l of (m.asks as Array<{ price: string; size: string }>) ?? [])
          c.asks.set(l.price, Number(l.size));
        emit(c);
      } else if (m.event_type === "price_change") {
        let touched = false;
        for (const ch of (m.price_changes as Array<{
          asset_id: string;
          price: string;
          size: string;
          side: string;
        }>) ?? []) {
          if (ch.asset_id !== token) continue; // changes can include both tokens
          const map = ch.side === "BUY" ? c.bids : c.asks;
          const sz = Number(ch.size);
          if (sz > 0) map.set(ch.price, sz);
          else map.delete(ch.price);
          touched = true;
        }
        if (touched) emit(c);
      }
    }
  });

  ws.on("close", () => {
    c.ws = null;
    if (!c.closed && c.subs.size) scheduleReconnect(token, c);
  });
  ws.on("error", () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  });
}

function scheduleReconnect(token: string, c: Conn) {
  if (c.reconnect || c.closed) return;
  c.reconnect = setTimeout(() => {
    c.reconnect = undefined;
    if (!c.closed && c.subs.size) connect(token, c);
  }, 2000);
}

/** Subscribe to a token's live book. Returns an unsubscribe fn. */
export function subscribePolyBook(token: string, marketId: string, cb: Sub): () => void {
  let c = conns.get(token);
  if (!c) {
    c = { ws: null, bids: new Map(), asks: new Map(), subs: new Set(), marketId, closed: false };
    conns.set(token, c);
    connect(token, c);
  }
  c.subs.add(cb);
  if (c.bids.size || c.asks.size) {
    try {
      cb(snapshot(c));
    } catch {
      /* ignore */
    }
  }
  return () => {
    const cc = conns.get(token);
    if (!cc) return;
    cc.subs.delete(cb);
    if (cc.subs.size === 0) {
      cc.closed = true;
      if (cc.reconnect) clearTimeout(cc.reconnect);
      try {
        cc.ws?.close();
      } catch {
        /* ignore */
      }
      conns.delete(token);
    }
  };
}
