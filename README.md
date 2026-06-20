<!-- Author: Bishakh -->

# 30-Day Frontend Architecture Challenge — World Cup 2026 Live Hub

A YouTube build series that teaches modern frontend & platform architecture by building **one real
product**: a live World Cup 2026 hub. Each day adds one increment and explains **the difference** —
the alternatives that exist and why we did/didn't use them.

- **Architecture & diagrams:** [`architecture.md`](./architecture.md)
- **Alternatives & why-not, per topic:** [`the-difference.md`](./the-difference.md)
- **How AI helps at every step (AI-engineer track):** [`ai-engineer-track.md`](./ai-engineer-track.md)
- **Eraser.io diagram-as-code (product + diagrams):** [`eraser-architecture.md`](./eraser-architecture.md)

Every episode carries two recurring beats: **"The Difference"** (alternatives & why-not) and the
**"AI co-pilot"** segment (prompt → generate → verify → correct → learn).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Product | World Cup 2026 live hub | Built-in hype; real-time is its heartbeat; CDN-heavy; splits cleanly into team-owned panels |
| Infra realism | Local-first, real tools (Compose → kind/k8s) | Reproducible on camera, $0, authentic |
| Match data | Simulator + real-API adapter (ports/adapters) | 24/7 always-on demos you can replay/accelerate; real feed swappable in |
| Frontend | Module Federation micro-frontends, Turborepo, React + Vite + TS | Textbook runtime MFE; teaches real mechanics |
| BFF | Node/TypeScript (Hono) | Classic "frontend team owns its backend"; contrast vs FastAPI core |
| Core backend | FastAPI + Postgres (+ Redis) | Domain services + real-time fan-out |
| Database scaling | Postgres primary + read replicas | Writes to primary, reads from replicas; teaches replication & read scaling for a read-heavy hub |

## 30-Day episode map

Each day = **build goal** + a **"The Difference"** teaching segment.

### Phase 0 — Foundations (Days 1–3)
| Day | Build goal | The Difference |
|---|---|---|
| 1 | Series intro; whiteboard the full architecture; local dev + Docker basics | Why this architecture vs a single monolith app |
| 2 | FastAPI core service + Postgres; first endpoints (teams, fixtures); docker-compose | ORM vs raw SQL; container vs bare-metal |
| 3 | Match simulator service; ports/adapters (sim + real-API adapter) | Simulated vs real data source; why an abstraction boundary |

### Phase 1 — Frontend & micro-frontends (Days 4–9)
| Day | Build goal | The Difference |
|---|---|---|
| 4 | Turborepo monorepo; shared packages; vertical-slicing concept | Monorepo vs polyrepo; vertical vs horizontal slicing |
| 5 | Build the Shell host app (React + Vite + TS) | SPA shell vs server-stitched composition |
| 6 | Module Federation — expose first remote (Scoreboard) | Runtime MF vs build-time vs iframes |
| 7 | Add remotes (Match Center, Standings, News); shared deps & version skew | Shared singletons vs duplication; version mismatch handling |
| 8 | BFF tier (Node/Hono) — aggregation & shaping | BFF vs direct core-API calls vs GraphQL |
| 9 | Wire MFEs → BFF → core API end-to-end | Over-fetching vs tailored payloads |

### Phase 2 — Real-time (Days 10–14)
| Day | Build goal | The Difference |
|---|---|---|
| 10 | Standings via **polling** | Polling intervals vs freshness vs load |
| 11 | Match Center via **SSE** | SSE vs polling; reconnection semantics |
| 12 | Scoreboard via **WebSocket** | WS vs SSE; bidirectional cost |
| 13 | Redis pub/sub fan-out from simulator; scaling real-time | In-process vs broker fan-out; sticky sessions |
| 14 | Comparison episode: Polling vs SSE vs WebSocket | When to use which (decision framework) |

### Phase 3 — Edge, gateway & CDN (Days 15–20)
| Day | Build goal | The Difference |
|---|---|---|
| 15 | HTTPS / TLS termination (local certs) | Terminate at edge vs origin vs mTLS |
| 16 | API Gateway in a private network (VPC) | Private gateway vs direct exposure vs mesh |
| 17 | Edge Functions intro (wrangler/workerd local) | Edge vs origin vs regional serverless |
| 18 | Edge auth (JWT) + content negotiation | JWT-at-edge vs server sessions |
| 19 | Rate limiting at edge (token bucket, Redis) | Edge vs app-level vs none |
| 20 | CDN — caching, cache headers, SWR, asset versioning, image optimization | CDN vs origin serving; cache-busting |

### Phase 4 — Scaling & ops (Days 21–25)
| Day | Build goal | The Difference |
|---|---|---|
| 21 | Load balancing (Nginx/HAProxy, replicas, health checks, algorithms) | L7 vs L4; round-robin vs least-conn; DNS RR |
| 22 | Containerization deep dive (multi-stage builds, image size, security) | Multi-stage vs single-stage; distroless |
| 23 | Orchestration with k8s (kind) — Deployments, Services | Compose vs k8s |
| 24 | k8s scaling (app tier) — HPA, rolling updates, self-healing | Manual scaling vs HPA; rolling vs recreate |
| 25 | Scaling the data tier — Postgres primary + read replicas, read/write split; then integrate edge + LB + gateway + k8s | Single DB vs read replicas; replication lag & read-after-write; sync vs async replication |

### Phase 5 — Performance & finale (Days 26–30)
| Day | Build goal | The Difference |
|---|---|---|
| 26 | Core Web Vitals intro + measuring (Lighthouse, `web-vitals`) | Field vs lab metrics |
| 27 | **LCP** — initial render; SSR/streaming; image & font strategy | CSR vs SSR vs streaming |
| 28 | **CLS** — layout stability with async micro-frontends | Reserved space vs layout shift |
| 29 | **INP** — interaction responsiveness; re-render cost | Heavy re-render vs memoization/concurrency |
| 30 | Finale — full system tour, recap, optional cloud-deploy teaser | Local vs real cloud (what changes) |
