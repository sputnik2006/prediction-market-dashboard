# CLAUDE.md

Handoff notes for Claude Code working in this repo. Read this before making changes.

## What this is

A Next.js 15 dashboard that prices the **same real-world question** on **Polymarket** and
**Kalshi**, then determines whether the gap between them is a tradeable edge or an illusion.
Cross-exchange matching, depth-aware arbitrage, and a resolution-divergence layer.

There is no separate backend. The server tier is Next.js route handlers under `app/api/`.

## The one rule that governs everything

> A visible price gap between two venues is, by default, **not** an edge.

A spread is only ever presented as tradeable when **all three** hold: the match is
`verified`, the depth-aware net edge is positive, and the divergence assessment is shown
alongside it. Every algorithm here is biased toward rejecting rather than guessing. If you
are tempted to loosen a threshold or drop a guard to "find more matches", that is almost
certainly the wrong direction — a false pair manufactures a phantom spread, which is worse
than a missing pair.

## Non-negotiable invariants

- **All prices and probabilities are floats in `[0,1]`.** Never cents, never 0–100.
  Conversion happens exactly once, inside each venue adapter. `lib/types.ts:2` states this.
- **The browser only ever talks to `/api/*`.** Kalshi returns `403` to any request carrying
  an `Origin` header, so a client-side fetch to a venue cannot work. `lib/http.ts` never
  sends `Origin`. Do not add a direct upstream call from a component.
- **`DataMode` propagates to the UI.** `live` / `snapshot` / `unreachable` is carried through
  the type system so the interface can never present demo data as live. If you add a data
  path, carry the mode through it. Snapshot history renders as dashed lines; that is
  deliberate, not a style choice.
- **Upstream wire shapes stay inside their adapter.** `KMarket`/`KEvent`, `GammaMarket`, and
  `PRMarket` are private to `lib/kalshi.ts`, `lib/polymarket.ts`, `lib/polyrouter.ts`. Do not
  let vendor JSON leak into the domain model.

## Where things live

| Concern | File | Notes |
|---|---|---|
| Domain types | `lib/types.ts` | Start here. The whole model is 222 lines. |
| Matching | `lib/match.ts` | 3 tiers, 4 guards. The densest module — read it fully before editing. |
| Entity aliases | `lib/entities.ts` | Person/country tables; teams use token overlap, no rosters. |
| Event registry | `lib/events.seed.ts` | Add a league/election here — one entry. |
| Arbitrage | `lib/arb.ts` | Book walk, fees, annualised ROI vs risk-free. |
| Divergence | `lib/divergence.ts` | Baked-in LLM-judge output. Not called at request time. |
| Corpus → pairs | `lib/aggregate.ts` | SWR cache shared by `/api/pairs` and `/api/arb`. |
| Resampling | `lib/series.ts` | Uniform grid — see the warning below. |
| Reachability | `lib/doh.ts`, `lib/polyws.ts` | DNS-over-HTTPS for Polymarket. |
| Prewarm | `instrumentation.ts` | Boot hook. Uses `fetch`, not a direct import — see below. |

## Things that will bite you

**`lib/series.ts` is load-bearing, not cosmetic.** `lightweight-charts` lays out points by
**index, not timestamp**. Feeding it irregular points produces a time axis whose labels don't
match the horizontal positions, and two venues' series that silently drift out of alignment
with each other. Everything must land on the shared uniform grid. Don't "simplify" this away.

**`instrumentation.ts` issues HTTP requests instead of importing `lib/aggregate` directly.**
That is not an oversight. Importing drags the upstream module graph into the instrumentation
webpack bundle, where Node built-ins fail to resolve. Leave it as a fetch.

**Two spread notions exist on purpose.** `lib/match.ts` computes a naive `|p − k|` with a flat
`FEE_BUFFER = 0.01` as a cheap corpus-wide **ranking pre-filter** (no order book needed).
`lib/arb.ts` does the real depth- and fee-aware walk — that's the **decision number**. The
radar deliberately *ranks* by the naive spread (net profit scales with size deployed, so it's
a poor sort key) while *reporting* the rigorous figure. Don't "fix" the inconsistency by
deleting one; see the cleanup note below for the actual fix.

**Kalshi's fee is non-linear:** `0.07 · p · (1−p)`, maximised at p=0.5. Polymarket's is ~0. A
flat fee assumption misprices exactly the mid-probability markets where spreads are widest.

**The `midOrLast` guard in `lib/kalshi.ts`.** A two-sided quote wider than 90¢ is a
market-maker placeholder whose midpoint is meaningless — it defers to last trade or returns
`null` rather than emitting a confident, wrong 50%. Don't remove it as a "simplification".

**Kalshi has no usable WebSocket here.** Its REST market data is public but the socket needs
API-key auth and request signing, so its book uses a 2s poll while Polymarket streams over
SSE. The asymmetry is the venue's auth model, not a bug.

## Common tasks

**Add a league or election to cross-exchange matching** — one entry in
`lib/events.seed.ts` (a Polymarket event slug + a Kalshi series ticker + `matchBy`). Teams
match by token overlap, so no roster data is needed. Then run the divergence judge over the
new event's resolution text and add the result to `lib/divergence.ts`, or it will fall back
to the generic politics warning.

**Change cache/refresh behaviour** — server TTLs are in the adapters and `lib/aggregate.ts`;
HTTP hints in `lib/config.ts` (`cacheSeconds`, with `stale-while-revalidate` set to 6× in
`lib/server.ts`); client polling in `lib/hooks.ts`. Keep the prewarm interval (150s) **under**
the corpus TTL (180s) or the cache goes cold in production.

**Debug "Polymarket shows snapshot"** — the degradation chain is direct DNS → DoH →
PolyRouter (if keyed) → stale cache → labeled snapshot. Usually a DNS block. Try
`POLY_DOH=on`. `POLY_SNAPSHOT=off` turns the fallback off so you see the real failure.

## Verifying a change

There is **no test suite** (see below), so verify by running it:

```bash
npm run dev        # http://localhost:3000
```

Expect ~17s of cold corpus build at boot — `instrumentation.ts` absorbs it before the first
request. Check `/` (radar populated, badges correct), `/compare` (dual-line chart aligned,
both books rendering), and a `/market/[venue]/[id]` detail page. To exercise the degradation
path, point `POLY_GAMMA_URL` at an unroutable host and confirm the banner appears, badges
flip to `SNAPSHOT`, and every view still works.

## Known gaps — good first contributions

1. **No tests at all.** Highest-value targets are pure and dependency-free: `weightedScore`
   and the four guards in `lib/match.ts`, the `walk()` accumulator in `lib/arb.ts`, and
   `resampleSeries` in `lib/series.ts`. The book walk especially — a two-pointer accumulator
   decrementing size across two ladders is exactly where an off-by-one is silent and returns
   a plausible-but-wrong number.
2. **`FEE_BUFFER = 0.01` is written three times** — `lib/match.ts:8`, and again in
   `components/CompareView.tsx`. Extract a single fee module so a fee change can't leave the
   paths disagreeing.
3. **The SWR + in-flight-dedup idiom is written out four times** (`lib/kalshi.ts`,
   `lib/polymarket.ts`, `lib/aggregate.ts`, `app/api/arb/route.ts`) with slightly divergent
   error handling. Extract `swrCache<T>(ttl, builder)`. DoH resolution is likewise duplicated
   between `lib/doh.ts` and `lib/polyws.ts` with independent caches.
4. **Dead code:** `components/SpreadTable.tsx` and `components/Sparkline.tsx` are unreferenced
   (`SpreadTable` was superseded by `ArbRadar`). The README architecture section still lists a
   "spread table" on the overview page. Delete both and fix the line.
5. **No CI, Dockerfile, or deployment manifest.** `npm run lint` is declared but there is no
   eslint config file, so it runs on `eslint-config-next` defaults only.

## Docs

- `README.md` — user-facing setup, features, data sources, DoH explanation.
- `report/report.tex` → `report/report.pdf` — 16-page technical report with a self-contained
  appendix (repo layout, API reference, data model, upstream/cache/config tables, algorithm
  pseudocode, event registry). Build with `tectonic report.tex` or `pdflatex report.tex` twice.
