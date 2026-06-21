<!-- Author: Bishakh -->

# Phase 1 — Monorepo, Micro-frontends & BFF

**Goal:** turn the backend foundation into a real UI — a **Turborepo monorepo** whose UI is composed
at runtime from **independently-built micro-frontends** (Module Federation), fed by a **Node/Hono
BFF** that shapes data per panel.

## What we built

```
worldcup-hub/
├─ package.json · pnpm-workspace.yaml · turbo.json · tsconfig.base.json   ← monorepo root
├─ packages/
│  ├─ types/        # @wc/types — shared BFF↔MFE contracts (Team, ScoreboardMatch, …)
│  └─ ui/           # @wc/ui   — shared design system (Panel, Score, LiveBadge)
├─ apps/
│  ├─ shell/            # @wc/shell — Module Federation HOST (loads remotes at runtime)
│  ├─ mfe-scoreboard/   # remote · port 5001 · exposes ./App
│  ├─ mfe-match-center/ # remote · port 5002
│  ├─ mfe-standings/    # remote · port 5003
│  └─ mfe-news/         # remote · port 5004
└─ services/
   └─ bff/          # @wc/bff — Node/Hono Backend-for-Frontend (port 8080)
```

### The pieces and why they exist

- **Monorepo (pnpm workspaces + Turborepo).** One repo, many packages. `pnpm` links workspace
  packages (`@wc/types`, `@wc/ui`) with `workspace:*`; `turbo` runs `build`/`dev`/`typecheck` across
  them with caching and correct ordering (`dependsOn: ["^build"]`).
- **Vertical slicing.** Each panel is a *slice* that owns its UI **and** its BFF route **and** its
  data concern end-to-end — Scoreboard owns `/bff/scoreboard`, Standings owns `/bff/standings`, etc.
- **Module Federation (host + remotes).** The `shell` host declares four remotes by URL
  (`http://localhost:500x/assets/remoteEntry.js`) and loads each `./App` **at runtime** with
  `React.lazy`. Each remote is a separate Vite app that emits a `remoteEntry.js` manifest. `react`
  and `react-dom` are declared **shared** so they're loaded once, not four times.
- **Per-remote error boundaries.** `RemoteSlot` wraps every remote in an error boundary + Suspense,
  so one failed micro-frontend shows a small placeholder instead of blanking the page.
- **BFF (Node/Hono).** Sits between the UI and the core services. It calls upstreams (the simulator,
  and later core-api), **aggregates and shapes** the response into exactly the view-model each panel
  needs (`ScoreboardMatch`, `StandingRow`, …), and wraps it in a `{ data, generated_at }` envelope.
  It degrades gracefully — if the simulator is down, `fetchEvents` returns `[]` and the UI still
  renders.

## How to run it

```bash
cd worldcup-hub
pnpm install
pnpm build                       # builds every package + remote (emits remoteEntry.js)

# run the stack (each in its own terminal, or use a process manager):
pnpm --filter @wc/bff start          # BFF on :8080  (needs simulator on :9000 for live scores)
pnpm --filter @wc/mfe-scoreboard preview   # :5001
pnpm --filter @wc/mfe-match-center preview # :5002
pnpm --filter @wc/mfe-standings preview    # :5003
pnpm --filter @wc/mfe-news preview         # :5004
pnpm --filter @wc/shell preview            # open http://localhost:5000
```

> Module Federation with Vite is most reliable through **build + `preview`** (each remote serves its
> built `remoteEntry.js`). `pnpm dev` works too, but preview is the canonical "it definitely works"
> path we verify in CI.

## Verified

- `pnpm build` → **7/7 tasks successful**; every remote emits `dist/assets/remoteEntry.js` +
  `__federation_expose_App` (Module Federation correctly wired).
- BFF smoke test: `/bff/health` → `{"status":"ok"}`; `/bff/news`, `/bff/standings`, `/bff/scoreboard`
  return shaped `{ data, generated_at }` envelopes; standings are computed from results.

## The Difference (alternatives & why-not)

| Decision | We chose | Instead of | Why |
|---|---|---|---|
| Composition | **Runtime Module Federation** | Single SPA / iframes / build-time import | independent deploys + shared singletons, no hard iframe isolation |
| Repo | **Monorepo (pnpm+Turbo)** | Polyrepo | atomic cross-cutting changes, shared `@wc/types` contract |
| Data for UI | **BFF shapes per panel** | MFEs call core API directly | no over-fetching, UI never sees raw domain shapes, one place to aggregate |
| Shared React | **`shared` singletons** | each remote bundles its own React | avoids multiple React copies (hook errors) + smaller payload |

## Next (Phase 2)

Right now the scoreboard shows a *computed final* score from the simulator. **Phase 2** makes it
**live**: WebSocket for the scoreboard, SSE for the match-center commentary, polling for standings —
all fanned out from the simulator through **Redis pub/sub**.
