<!-- Author: Bishakh -->

# Eraser.io Architecture — World Cup 2026 Live Hub

Paste the code blocks below into [eraser.io](https://eraser.io) (use a **Diagram-as-code** →
*Cloud Architecture Diagram* for the first, *Sequence Diagram* for the second).

## Product

**World Cup 2026 Live Hub** — a real-time web app for following the tournament live: live scores,
ball-by-ball commentary, lineups & stats, group standings, fixtures, and news/highlights. The UI is
composed from independently-deployed micro-frontends, each using the right real-time transport.

## End goal

- **Fans:** one fast, always-fresh place to follow every match — sub-second score updates,
  zero-refresh commentary, resilient under goal-moment traffic spikes.
- **Builder:** a single product that authentically exercises every architecture topic (the original 11 + database replication), built with AI.

---

## 1. Full End-to-End Architecture (eraser.io)

One diagram covering the whole system: **source/monorepo → build → container registry →
Kubernetes orchestration → runtime request path → data & real-time fan-out**. Each cluster maps to
the topics it teaches (see comments).

> This is the exact definition now live in the eraser.io workspace. Note: the API Gateway uses a
> distinct icon from the Load Balancer (so the two read as separate components), and Postgres is shown
> as **primary + two read replicas** to teach replication and read/write splitting.
>
> **Data sources are now on the diagram (red group).** The hub runs in two modes: a **real-data path**
> where the BFF calls external football APIs server-side, and a **simulated path** (simulator → Redis →
> core services) for offline/replayable demos. See *Data sources* below for exactly who calls what.

```eraser
// World Cup 2026 Live Hub - End to End Architecture

Fan [icon: user]

Micro-frontends [icon: monitor, color: blue] {
  Shell Host [icon: react]
  Scoreboard WS [icon: react]
  Match Center SSE [icon: react]
  Standings Poll [icon: react]
  News CDN [icon: react]
}

Public Edge [icon: cloud, color: orange] {
  CDN Proxy [icon: cloudflare]
  Edge Worker [icon: cloudflare]
}

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

Data Stores [icon: database, color: purple] {
  Postgres Primary [icon: postgresql]
  Postgres Replica 1 [icon: postgresql]
  Postgres Replica 2 [icon: postgresql]
  Redis [icon: redis]
}

External Data Providers [icon: globe, color: red] {
  football-data.org [icon: globe]
  ESPN Site API [icon: globe]
  API-Football [icon: globe]
  TheSportsDB [icon: globe]
}

Build Pipeline [icon: github, color: gray] {
  Turborepo [icon: github]
  CI Build [icon: docker]
  Registry [icon: docker]
}

Turborepo > CI Build > Registry
Registry > Kubernetes VPC: deploy

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

// Real-data path: the BFF fetches real World Cup data server-side (in-memory cached, serves stale on error)
BFF > football-data.org: fixtures · scores · standings (X-Auth-Token)
BFF > ESPN Site API: commentary · lineups · stats (keyless)
BFF > API-Football: rich detail for played matches (optional, x-apisports-key)
// Simulator real adapters (sim fallback path, DATA_SOURCE=real | thesportsdb)
Simulator > football-data.org: poll live (real mode)
Simulator > TheSportsDB: poll live (keyless test key)

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
```

---

## 2. Real-time Sequence Diagram (eraser.io)

```eraser
title Real-time Fan-out — one simulator, three transports

Simulator > Redis: publish match.event (goal/card/sub)
Redis > Core Services: subscribers receive event
Core Services > Scoreboard (WS): push live score
Core Services > Match Center (SSE): stream commentary line
Standings (Poll) > Core Services: GET /standings every ~15s (cached)
Core Services > Standings (Poll): standings snapshot (SWR)
```

---

## 3. Request Lifecycle Sequence (eraser.io)

```eraser
title Request Lifecycle — cache → edge → VPC → origin

Browser > CDN: GET /api/match/123
CDN > Browser: cached response [if cache hit / SWR]
CDN > Edge Worker: forward [if cache miss]
Edge Worker > Edge Worker: TLS · verify JWT · rate-limit · negotiate
Edge Worker > Load Balancer: forward (private)
Load Balancer > API Gateway: route to healthy replica
API Gateway > BFF: MFE-shaped request
BFF > Core API: fetch fixtures + lineup + stats
Core API > Postgres: query
Postgres > Core API: rows
Core API > BFF: domain data
BFF > API Gateway: shaped payload
API Gateway > Edge Worker: response (+cache-control)
Edge Worker > CDN: response
CDN > Browser: response (now cached)
```

---

## Data sources — where the real data comes from

The hub serves **two interchangeable data paths**, selected by env vars. This is the ports/adapters
teaching point made real: the UI contract (`@wc/types`) is identical either way.

### Path A — Real data (default when a key is present)
The **BFF** (`services/bff/src/`) calls external providers directly, server-side, each behind a small
in-memory TTL cache that serves the last good (stale) value on upstream error:

| Provider | Endpoint (base) | Auth | In code | What it supplies |
|---|---|---|---|---|
| **football-data.org** v4 | `api.football-data.org/v4` | `X-Auth-Token` header — free tier ~10 req/min | `footballData.ts` | All 104 fixtures, live scores, group standings. Workhorse: `/competitions/WC/matches`. |
| **ESPN Site API** | `site.api.espn.com/apis/site/v2/sports/soccer` (league `fifa.world`) | **none (keyless)** | `espn.ts` | Flowing play-by-play **commentary**, key events (goals/cards), **lineups + formations**, **statistics**. Endpoints: `/scoreboard?dates=`, `/summary?event=`. Streamed over SSE for live matches. |
| **API-Football** v3 | `v3.football.api-sports.io` | `x-apisports-key` header — free tier 100 req/day | `apiFootball.ts` | Optional richer detail (lineups/events/stats) for **played** matches; default season WC 2022. |

> The BFF resolves a football-data fixture to its ESPN event by **date + team name match** (different
> providers use different fixture ids), then maps everything into the shared `MatchEvent[]` / view-model
> contract. Switch logic: `USE_REAL = FOOTBALL_API_KEY set && DATA_SOURCE !== "sim"`.

### Path B — Simulated / offline (fallback, always available)
The **Simulator** (`services/simulator/`) publishes match events to **Redis**; core services subscribe
and fan out over WS/SSE. Its source is chosen by `DATA_SOURCE`:

| `DATA_SOURCE` | Adapter | Source |
|---|---|---|
| `sim` (default) | `adapters/simulated.py` | Deterministic in-process match engine — no network, replayable. |
| `real` | `adapters/real_api.py` | Polls **football-data.org** live matches. |
| `thesportsdb` | `adapters/thesportsdb.py` | Polls **TheSportsDB** (`thesportsdb.com/api/v1/json`, free test key `123`) — real teams + scores, past + upcoming. |

> **core-api** (FastAPI + Postgres) holds the domain model (teams, fixtures) and does **not** call any
> external API — it's the read/write-split database tier.

---

### Notes for drawing
- The **VPC group** is the teaching point: only the *Public Edge Layer* is exposed; everything inside
  the VPC has no public ports.
- Color the three **real-time transports** differently (WS / SSE / Polling) so the contrast pops on screen.
- The **Compose → Kubernetes** evolution (Phase 4) can be a second, simpler diagram: one box "Docker
  Compose (one network)" with an arrow to "Kubernetes (Deployments · HPA · rolling updates · self-heal)".
