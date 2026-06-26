/**
 * Next.js startup hook. The cross-exchange corpus + pairs build is heavy
 * (~17s cold: paginated Kalshi/Polymarket corpuses + event fetches + matching),
 * so we warm it shortly after boot and refresh it before the 180s cache TTL —
 * a user's first page load (and every later one) then hits a warm cache.
 *
 * We warm by hitting the local /api/pairs endpoint rather than importing the
 * server modules directly: importing lib/aggregate here drags the whole upstream
 * graph (undici, etc.) into the instrumentation webpack bundle and fails to
 * resolve Node built-ins, which breaks the entire server. A plain fetch doesn't.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const port = process.env.PORT || "3000";
  const base = `http://127.0.0.1:${port}`;
  // Warm the two heavy endpoints: pairs (corpus + matching) and arb (walks books).
  const warm = () =>
    Promise.all([
      fetch(`${base}/api/pairs`).catch(() => {}),
      fetch(`${base}/api/arb`).catch(() => {}),
    ]).then(() => {});

  // The server may still be compiling at boot — retry a few times early to catch
  // the ready moment, then settle into a steady keep-warm under the 180s TTL.
  let attempts = 0;
  const early = setInterval(() => {
    warm();
    if (++attempts >= 6) clearInterval(early);
  }, 5000);
  early.unref?.();

  const keep = setInterval(warm, 150_000);
  keep.unref?.();
}
