<!-- Author: Bishakh -->

# World Cup 2026 Live Hub — Architecture

> The teaching vehicle for the **30-Day Frontend Architecture Challenge**.
> One product, built up day by day, that forces every topic to appear for a *real* reason —
> and for each topic we show **the naive way → why it breaks → what we use → the trade-off we accepted.**

---

## 1. System Topology (containers on a private network)

Every box below is a real container. The **public edge layer** is the only thing exposed;
everything else lives on a private Docker network (our "VPC").

```mermaid
flowchart TD
    Browser([Browser / Client])

    subgraph EXT[External Data Providers]
      FD["football-data.org v4<br/>fixtures · scores · standings"]
      ESPN["ESPN Site API (keyless)<br/>commentary · lineups · stats"]
      AF["API-Football (optional)<br/>played-match detail"]
      TSDB["TheSportsDB (keyless)<br/>sim real-source"]
    end

    subgraph PUBLIC[Public Edge Layer]
      CDN["CDN Proxy<br/>static + image cache · SWR"]
      EDGE["Edge Worker<br/>TLS · JWT auth · rate limit<br/>content negotiation · edge cache"]
    end

    subgraph VPC[Private Network — VPC]
      LB["Load Balancer<br/>Nginx/HAProxy · health checks"]
      GW["API Gateway<br/>single guarded door · routing · policy"]
      BFF["BFF — Node/Hono<br/>aggregate + shape per micro-frontend"]

      subgraph CORE[Core Services — FastAPI]
        SVC1["Fixtures / Results"]
        SVC2["Standings"]
        SVC3["Commentary / Score"]
      end

      SIM["Match Simulator<br/>sim + real-API adapter (ports/adapters)"]
      REDIS[("Redis<br/>pub/sub fan-out · rate-limit buckets")]

      subgraph DB[Postgres — primary + read replicas]
        PGP[("Postgres Primary<br/>all writes")]
        PGR1[("Read Replica 1<br/>reads")]
        PGR2[("Read Replica 2<br/>reads")]
      end
    end

    Browser --> CDN --> EDGE --> LB --> GW
    GW --> BFF
    GW --> CORE
    BFF --> CORE
    CORE -- writes --> PGP
    CORE -- reads --> PGR1
    PGP -- replicate --> PGR1
    PGP -- replicate --> PGR2
    SIM -- writes --> PGP
    SIM --> REDIS
    CORE --> REDIS

    %% Real-data path: BFF calls external football APIs server-side (cached, stale-on-error)
    BFF -- "fixtures/scores/standings" --> FD
    BFF -- "commentary/lineups/stats" --> ESPN
    BFF -. "optional rich detail" .-> AF
    %% Simulator real adapters (DATA_SOURCE=real | thesportsdb)
    SIM -. "real mode" .-> FD
    SIM -. "real mode (keyless)" .-> TSDB
```

**Three deliberate teaching points in this topology:**
- **API Gateway ≠ Load Balancer.** The LB spreads traffic across replicas (and removes unhealthy ones); the gateway is the single policy/routing door into the VPC. They're separate boxes on purpose.
- **Postgres is primary + read replicas.** All writes go to the primary; reads are served from replicas; the primary streams changes to the replicas (replication). This is how the read-heavy hub scales reads without overloading one database.
- **The BFF owns the external-data integration.** Real World Cup data comes from third-party APIs the **BFF** calls server-side (never the browser) — so keys stay secret, responses are cached/shaped, and the UI contract is identical whether data is real or simulated. See §8.

---

## 2. Frontend — Micro-frontend composition (Module Federation)

A **shell host** owns routing, layout and shared dependencies. Each panel is an independent
**remote**, built and deployed on its own cadence by its own "team", and each deliberately uses a
**different real-time transport** so one product showcases all three.

```mermaid
flowchart TD
    SHELL["Shell Host App<br/>routing · layout · shared deps · error boundaries"]
    R1["Remote: Scoreboard<br/>transport: WebSocket"]
    R2["Remote: Match Center<br/>transport: SSE"]
    R3["Remote: Standings<br/>transport: Polling"]
    R4["Remote: News / Highlights<br/>CDN / static — heavy reads"]

    SHELL -. "Module Federation (runtime load)" .-> R1
    SHELL -. "Module Federation (runtime load)" .-> R2
    SHELL -. "Module Federation (runtime load)" .-> R3
    SHELL -. "Module Federation (runtime load)" .-> R4
```

**Vertical slicing:** each slice owns its UI **and** its BFF route **and** its data domain end-to-end —
not split horizontally by layer.

---

## 3. Request lifecycle (cache → edge → VPC → origin)

```mermaid
sequenceDiagram
    participant B as Browser
    participant CDN as CDN Proxy
    participant E as Edge Worker
    participant LB as Load Balancer
    participant GW as API Gateway (VPC)
    participant BFF as BFF (Node)
    participant API as FastAPI Core
    participant DB as Postgres

    B->>CDN: GET /api/match/123
    alt cache hit (fresh or stale-while-revalidate)
        CDN-->>B: cached response
    else cache miss
        CDN->>E: forward
        E->>E: terminate TLS · verify JWT · rate-limit · negotiate content
        E->>LB: forward (private network)
        LB->>GW: route to healthy replica
        GW->>BFF: MFE-shaped request
        BFF->>API: fetch fixtures + lineup + stats (fan-out)
        API->>DB: query
        DB-->>API: rows
        API-->>BFF: domain data
        BFF-->>GW: shaped payload (only what the UI needs)
        GW-->>E: response (+ cache-control headers)
        E-->>CDN: response
        CDN-->>B: response (now cached)
    end
```

---

## 4. Real-time fan-out (one simulator, three transports)

```mermaid
sequenceDiagram
    participant Sim as Match Simulator
    participant Redis as Redis (pub/sub)
    participant API as FastAPI (Score/Commentary)
    participant WS as Scoreboard — WebSocket
    participant SSE as Match Center — SSE
    participant Poll as Standings — Polling

    Sim->>Redis: publish match.event (goal / card / sub / stat)
    Redis-->>API: subscribers receive event
    API-->>WS: push live score (bidirectional WebSocket)
    API-->>SSE: stream commentary line (one-way SSE)
    Note over Poll,API: Standings does NOT subscribe —
    Poll->>API: GET /standings every ~15s (cached, SWR)
```

**The difference, on camera:** Polling = simple, wasteful, laggy. SSE = one-way, auto-reconnect, HTTP-native.
WebSocket = bidirectional, lowest latency, more ops cost. We prove *per-use-case* selection instead of one transport everywhere.

---

## 5. Deployment evolution (Compose → Kubernetes)

We start where it's simplest and graduate only when the simpler tool visibly stops being enough.

```mermaid
flowchart LR
    subgraph P1["Phase 1 — Docker Compose"]
      C["All services as containers<br/>one private network<br/>(no self-healing / autoscale)"]
    end
    subgraph P2["Phase 2 — Kubernetes (kind, local)"]
      D["Deployments + Services<br/>HPA autoscaling · rolling updates<br/>self-healing · liveness/readiness"]
    end
    C ==>|"why Compose stops being enough"| D
```

---

## 6. Repository structure (Turborepo monorepo)

```
worldcup-hub/                      # Turborepo root
├─ apps/
│  ├─ shell/                       # MFE host (React + Vite + TS)
│  ├─ mfe-scoreboard/              # remote — WebSocket
│  ├─ mfe-match-center/            # remote — SSE
│  ├─ mfe-standings/               # remote — polling
│  └─ mfe-news/                    # remote — CDN / static
├─ services/
│  ├─ bff/                         # Node/Hono BFF (per-frontend shaping)
│  ├─ core-api/                    # FastAPI + Postgres (domain services)
│  ├─ simulator/                   # FastAPI match simulator (+ real-API adapter)
│  ├─ edge/                        # edge worker (wrangler/workerd or Hono)
│  ├─ gateway/                     # API gateway config
│  ├─ lb/                          # Nginx / HAProxy config
│  └─ cdn/                         # caching proxy config
├─ packages/
│  ├─ ui/                          # shared design system
│  ├─ types/                       # shared TS types (BFF <-> MFEs)
│  └─ config/                      # shared tsconfig / eslint
├─ infra/
│  ├─ docker/                      # Dockerfiles + docker-compose.yml
│  └─ k8s/                         # kind cluster + manifests + HPA
├─ docs/                           # per-day tutorial write-ups
└─ turbo.json
```

---

## 7. Topic → component map

| # | Topic | Where it lives in this build |
|---|-------|------------------------------|
| 1 | Micro-frontend | Shell host loads remotes via Module Federation |
| 2 | Monorepo + vertical slicing | Turborepo; each slice owns UI + BFF route + data domain |
| 3 | Edge Functions (cache/HTTPS/auth/content-negotiation/rate-limit) | Edge worker tier — one feature per sub-topic |
| 4 | API Gateway in VPC | Gateway container on private network, no public ports |
| 5 | Load Balancing | Nginx/HAProxy across core-service replicas + health checks |
| 6 | Container System | Docker multi-stage builds, one Dockerfile per service |
| 7 | Orchestration | kind/k8s — Deployments, Services, HPA, rolling updates |
| 8 | BFF | Node/Hono tier shaping data per micro-frontend |
| 9 | CDN | Caching proxy + cache headers + SWR + asset versioning |
| 10 | Core Web Vitals (LCP/INP/CLS) | Measured with Lighthouse + `web-vitals`, fixed live |
| 11 | Real-time (Polling/WS/SSE) | Standings=poll, Match Center=SSE, Scoreboard=WS, via Redis fan-out |
| 12 | Database replication & read scaling | Postgres primary (writes) + read replicas (reads); streaming replication; read/write split in core-api |
| 13 | External data integration (BFF as anti-corruption layer) | BFF calls football-data.org + ESPN (+ optional API-Football); simulator real adapters call football-data.org / TheSportsDB |

See [`the-difference.md`](./the-difference.md) for the alternatives-and-why-not table that anchors each episode.

---

## 8. Data sources — real feeds vs the simulator

The hub runs two interchangeable data paths behind the **same** UI contract (`@wc/types`) — the
ports/adapters principle made real. Which one is live is decided by env vars, not code changes.

### Real-data path (default when `FOOTBALL_API_KEY` is set)
The **BFF** (`services/bff/src/`) is the integration point. It calls third-party football APIs
**server-side only** (keys never reach the browser), each wrapped in a small in-memory TTL cache that
serves the last good value if the upstream errors:

| Provider | Base | Auth | File | Supplies |
|---|---|---|---|---|
| football-data.org v4 | `api.football-data.org/v4` | `X-Auth-Token` (~10 req/min free) | `footballData.ts` | 104 fixtures, live scores, standings (`/competitions/WC/matches`) |
| ESPN Site API | `site.api.espn.com/.../soccer` · `fifa.world` | keyless | `espn.ts` | commentary, key events, lineups+formations, statistics; streamed over SSE |
| API-Football v3 | `v3.football.api-sports.io` | `x-apisports-key` (100/day) | `apiFootball.ts` | optional played-match detail (WC 2022) |

The BFF resolves a football-data fixture to its ESPN event by **date + team-name** match (providers
use different ids), then maps both into the shared view-model. Switch: `USE_REAL = key set && DATA_SOURCE !== "sim"`.

### Simulated path (offline fallback, always available)
The **simulator** (`services/simulator/`) publishes events to Redis; core services fan them out.
Its source is set by `DATA_SOURCE`: `sim` (deterministic engine, no network — the demo default),
`real` (polls football-data.org), or `thesportsdb` (polls TheSportsDB, free test key `123`).

> **core-api never calls an external API** — it owns the Postgres domain model and the read/write split.
> All third-party traffic is isolated to the BFF and the simulator's adapters.
