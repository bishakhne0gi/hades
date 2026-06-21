<!-- Author: Bishakh -->

# Phase 5 — Core Web Vitals (LCP, INP, CLS)

**Goal:** stop guessing about performance and **measure** it. Instrument the shell with the three
field metrics Google uses, show them live, and fix the one a micro-frontend architecture most
threatens: **layout shift**.

## The three metrics

| Metric | Full name | Measures | "Good" |
|---|---|---|---|
| **LCP** | Largest Contentful Paint | how fast the main content renders (initial render) | ≤ 2.5 s |
| **INP** | Interaction to Next Paint | how responsive the UI feels (re-render cost) | ≤ 200 ms |
| **CLS** | Cumulative Layout Shift | how much the layout jumps around | ≤ 0.1 |

## What we built (in `apps/shell`)

- **`src/vitals.ts`** — subscribes to `onLCP` / `onINP` / `onCLS` from the `web-vitals` library and
  exposes Google's good/needs-improvement/poor thresholds + a `rating()` helper.
- **`src/VitalsHud.tsx`** — a fixed on-screen HUD that shows live LCP / INP / CLS, colour-coded by
  rating (green / orange / red). Perfect for "before vs after" demos on camera.
- **CLS fix in `src/RemoteSlot.tsx`** — each federated remote loads **asynchronously**, so without
  reserved space the panels pop in and shove the layout down (bad CLS). We now reserve a
  `min-height: 220px` per slot, so the space is held while the remote loads → no shift.

## Why micro-frontends make this matter more

This is the honest "difference" for this architecture:
- **CLS** — remotes arrive at different times over the network; each late arrival can shift everything
  below it. Reserved space (skeletons / min-heights) is essential, not optional.
- **LCP** — the host must render *something* meaningful fast; the largest element shouldn't wait on a
  slow remote. Stream the shell shell-first, hydrate remotes after.
- **INP** — four independent React trees mean interaction work can pile up; keep each remote's render
  cheap (memoization, avoid blocking the main thread on message floods from the WebSocket).

## How to measure

```bash
pnpm --filter @wc/shell build && pnpm --filter @wc/shell preview   # http://localhost:5000
# 1) the on-screen HUD shows live LCP / INP / CLS
# 2) lab audit:
npx lighthouse http://localhost:5000 --only-categories=performance --view
```

## Verified

- Shell builds with `web-vitals` wired in (`pnpm --filter @wc/shell build` ✓).
- HUD renders the three metrics; `RemoteSlot` reserves space so async remotes don't shift layout.

## The Difference

| | We do | Instead of | Why |
|---|---|---|---|
| Perf | **measure** field metrics (web-vitals) + lab (Lighthouse) | "looks fast" | real user metrics, not vibes |
| CLS | reserve space for async remotes | let them pop in | async MFEs shift layout without reserved space |
| LCP | shell-first render | block on a remote | the largest content paints without waiting |
| INP | keep remote renders cheap | unbounded re-renders | high-rate WS/SSE updates can stall interactions |

## The series is complete 🎉

Phases 0→5 build the full World Cup 2026 Live Hub end to end: FastAPI + Postgres (layered, with read
replicas) · match simulator · Redis real-time fan-out · Module Federation micro-frontends · Node/Hono
BFF · public edge (TLS/JWT/rate-limit/negotiation/cache) · Nginx gateway/LB/CDN · Docker + Kubernetes
(HPA) · Core Web Vitals. Each phase has its own `docs/phase-N-*.md` and the "naive → why-it-breaks →
what-we-use → trade-off" teaching arc.
