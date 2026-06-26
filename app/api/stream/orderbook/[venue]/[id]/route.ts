import { fetchPolymarketMarket } from "@/lib/polymarket";
import { subscribePolyBook } from "@/lib/polyws";
import type { Orderbook } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stream/orderbook/polymarket/<conditionId>
 * Server-Sent Events stream of the live Polymarket order book (tick-by-tick via
 * the CLOB websocket). Kalshi has no public WS auth here, so it stays on polling.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ venue: string; id: string }> }
) {
  const { venue, id } = await ctx.params;
  if (venue !== "polymarket") {
    return new Response("streaming only available for polymarket", { status: 400 });
  }

  const cond = decodeURIComponent(id);
  const market = await fetchPolymarketMarket(cond);
  const token = market?.tokenIds?.[0];
  if (!token) return new Response("no token for market", { status: 404 });

  const enc = new TextEncoder();
  let unsub: () => void = () => {};
  let hb: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (book: Orderbook) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(book)}\n\n`));
        } catch {
          /* stream closed */
        }
      };
      unsub = subscribePolyBook(token, `polymarket:${cond}`, send);
      // heartbeat keeps the connection from idling out
      hb = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: hb\n\n`));
        } catch {
          /* ignore */
        }
      }, 15000);
      req.signal.addEventListener("abort", () => {
        if (hb) clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      if (hb) clearInterval(hb);
      unsub();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
