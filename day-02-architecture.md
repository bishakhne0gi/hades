<!-- Author: Bishakh -->

# Day 2 — Architecture & the Reasons Behind Every Box

> **Goal of today's episode:** take the product we demoed on Day 1 and reveal its skeleton. We build
> the full system diagram live in **eraser.io** ([workspace](https://app.eraser.io/workspace/yW5dwzoVaf1SoASpprrf)),
> then justify every box and every arrow. By the end the viewer can redraw it from memory and explain
> *why each tier exists* — that's the map for the next 28 days.
>
> Diagram source of truth: [`eraser-architecture.md`](./eraser-architecture.md) ·
> Topology detail: [`architecture.md`](./architecture.md) · Alternatives table: [`the-difference.md`](./the-difference.md)

---

## How to run the segment

1. Open the eraser.io workspace. Switch to **Code Editor** so viewers see diagram-as-code, not drag-and-drop.
2. Build the diagram **incrementally** — paste one cluster at a time and let it render, narrating the reason as each appears. Don't reveal the finished picture at once; the suspense *is* the teaching.
3. Each block below = one chunk to paste + the line you say while it renders.

The complete, final diagram code already lives in the workspace and in
[`eraser-architecture.md`](./eraser-architecture.md). Below it's broken into the order you reveal it.

---

## The build order (paste these one cluster at a time)

### Beat 1 — Start with the fan
```eraser
Fan [icon: user]
```
> "Everything exists to serve this one person watching a goal go in. We'll never lose sight of them.
> Every box we add has to earn its place by making *their* experience faster or more reliable."

### Beat 2 — The screen they see (micro-frontends)
```eraser
Micro-frontends [icon: monitor, color: blue] {
  Shell Host [icon: react]
  Scoreboard WS [icon: react]
  Match Center SSE [icon: react]
  Standings Poll [icon: react]
  News CDN [icon: react]
}
```
> "The page isn't one app — it's five, stitched at runtime. A **shell host** owns layout and routing;
> each panel is an independently deployed **remote**. Notice the suffixes: `WS`, `SSE`, `Poll`, `CDN` —
> each panel deliberately uses a *different* real-time transport, because no single transport is right
> for everything. That's the whole Day 11–15 arc previewed in four words."
> **The difference:** one SPA monolith would mean one deploy for the whole UI and one team bottleneck.

### Beat 3 — The public edge (the only thing exposed)
```eraser
Public Edge [icon: cloud, color: orange] {
  CDN Proxy [icon: cloudflare]
  Edge Worker [icon: cloudflare]
}
```
> "This orange layer is the *only* thing on the public internet. The CDN serves cached static assets
> close to the fan; the edge worker does the cheap, early work — TLS, JWT auth, rate-limiting,
> content negotiation — so bad traffic is rejected *before* it ever costs us an origin server."
> **The difference:** doing auth/rate-limit at the origin means abusers already reached your core.

### Beat 4 — The private network (the VPC) — the key teaching point
```eraser
Kubernetes VPC [icon: kubernetes, color: green] {
  Load Balancer [icon: nginx]
  API Gateway [icon: aws-api-gateway]
  BFF [icon: nodejs]
  Core Services [icon: python, color: teal] {
    Fixtures Service [icon: python]
    Standings Service [icon: python]
    Commentary Service [icon: python]
  }
  Simulator [icon: python]
}
```
> "Inside the green box, nothing has a public port. Two boxes look similar but are *not* the same:
> - **Load Balancer** spreads traffic across healthy replicas and drops the unhealthy ones.
> - **API Gateway** is the single guarded *door* into the VPC — routing and policy, one place.
>
> Behind them: the **BFF** (one backend shaped per frontend) and the **Core Services** that own the
> actual domain — fixtures, standings, commentary. The **Simulator** is our always-on match-event
> generator so demos run 24/7 and are replayable."
> **The difference:** gateway ≠ load balancer — they're different jobs, so they're different boxes.

### Beat 5 — Data: primary + read replicas + Redis
```eraser
Data Stores [icon: database, color: purple] {
  Postgres Primary [icon: postgresql]
  Postgres Replica 1 [icon: postgresql]
  Postgres Replica 2 [icon: postgresql]
  Redis [icon: redis]
}
```
> "A live hub is overwhelmingly *reads* — thousands watching, a handful of writes per match. So
> **all writes go to one primary**, and **reads fan out to replicas** the primary streams changes to.
> **Redis** is the real-time backbone: the simulator publishes an event once, every subscriber gets it."
> **The difference:** a single database makes reads and writes fight for the same node — replicas scale
> reads cheaply, at the cost of **replication lag** (read-after-write can be briefly stale), which we'll show.

### Beat 5b — Where the *real* data comes from (external providers)
```eraser
External Data Providers [icon: globe, color: red] {
  football-data.org [icon: globe]
  ESPN Site API [icon: globe]
  API-Football [icon: globe]
  TheSportsDB [icon: globe]
}
```
> "None of this data is ours — it's real World Cup data from third parties. **football-data.org** gives
> fixtures, scores and standings; **ESPN's keyless site API** gives the flowing commentary, lineups and
> stats; **API-Football** is an optional richer source for finished matches. The golden rule: the
> *browser never calls these* — the **BFF** does, server-side, so the API keys stay secret, responses
> are cached, and we map every provider into one shared shape. **TheSportsDB** is a keyless source the
> simulator can poll. Swap the feed, the UI never notices — that's ports & adapters."
> **The difference:** calling third-party APIs straight from the browser leaks keys, fights CORS, and
> can't be cached — so the integration lives in the BFF.

### Beat 6 — Where it all comes from (build pipeline)
```eraser
Build Pipeline [icon: github, color: gray] {
  Turborepo [icon: github]
  CI Build [icon: docker]
  Registry [icon: docker]
}

Turborepo > CI Build > Registry
Registry > Kubernetes VPC: deploy
```
> "One Turborepo monorepo builds every service, CI bakes container images, pushes them to a registry,
> and Kubernetes pulls and deploys them. One source tree → many independently deployed containers."

### Beat 7 — Draw the request path
```eraser
Fan > Shell Host
Shell Host > Scoreboard WS
Shell Host > Match Center SSE
Shell Host > Standings Poll
Shell Host > News CDN
Shell Host > CDN Proxy
CDN Proxy > Edge Worker
Edge Worker > Load Balancer
Load Balancer > API Gateway
API Gateway > BFF
API Gateway > Core Services
BFF > Core Services
```
> "Follow one request: fan → shell → CDN → edge → load balancer → gateway → BFF → core. Every hop
> has exactly one reason to exist. If you can't say why a hop is there, it shouldn't be."

### Beat 8 — Draw the data + real-time path
```eraser
// Database replication: writes to primary, reads from a replica
Core Services > Postgres Primary: writes
Core Services > Postgres Replica 1: reads
Postgres Primary > Postgres Replica 1: replicate
Postgres Primary > Postgres Replica 2: replicate

Simulator > Postgres Primary: writes
Simulator > Redis: publish
Redis > Core Services: subscribe
Core Services > Scoreboard WS: WebSocket
Core Services > Match Center SSE: SSE
Edge Worker > Redis: rate limit

// Real-data path: the BFF fetches real World Cup data server-side (cached)
BFF > football-data.org: fixtures · scores · standings
BFF > ESPN Site API: commentary · lineups · stats (keyless)
BFF > API-Football: rich detail (optional)
Simulator > football-data.org: poll live (real mode)
Simulator > TheSportsDB: poll live (keyless)
```
> "Now the heartbeat: the simulator writes the event and **publishes once** to Redis. Core services are
> subscribed, and push it out over the *right* transport per panel — WebSocket to the scoreboard, SSE to
> commentary. Standings just polls on a timer. One event, three delivery styles, chosen on purpose."

---

## The two paths to leave on screen

End the episode by tracing these two flows over the finished diagram — they're the spine of the series:

1. **Request lifecycle:** `Browser → CDN → Edge → LB → Gateway → BFF → Core → Postgres` and back,
   with caching at the edge. (Sequence diagram in [`eraser-architecture.md`](./eraser-architecture.md) §3.)
2. **Real-time fan-out:** `Simulator → Redis → Core → {WS, SSE, Poll}`. (Sequence diagram §2.)

---

## Topic → which day we open this box

Tie the diagram forward so viewers know the payoff schedule:

| Box on the diagram | We open it on |
|---|---|
| Core Services + Postgres | Day 3 |
| Simulator (ports/adapters) | Day 4 |
| Turborepo monorepo | Day 5 |
| Shell Host + remotes (Module Federation) | Days 6–8 |
| BFF | Days 9–10 |
| External Data Providers (football-data / ESPN / API-Football / TheSportsDB) | Days 4 (sim adapters) & 9–10 (BFF) |
| Scoreboard WS / Match Center SSE / Standings Poll + Redis | Days 11–15 |
| Edge Worker (TLS / auth / rate-limit) + CDN Proxy | Days 16–21 |
| Load Balancer · API Gateway · Kubernetes VPC | Days 22–25 |
| Postgres Primary + Read Replicas | Day 26 |
| Micro-frontends performance (CWV) | Days 27–29 |

> Closing line: *"That's the entire map. For the next 28 days we zoom into one box at a time — build it,
> break the naive version, and show the difference. See you on Day 3."*
