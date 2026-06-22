<!-- Author: Bishakh -->

# 30-Day Frontend Architecture Challenge — World Cup 2026 Live Hub

A YouTube build series that teaches modern frontend & platform architecture by building **one real
product**: a live World Cup 2026 hub. Each day adds one increment and explains **the difference** —
the alternatives that exist and why we did/didn't use them.

- **Architecture & diagrams:** [`architecture.md`](./architecture.md)
- **Alternatives & why-not, per topic:** [`the-difference.md`](./the-difference.md)
- **Deep topics index (NGINX, kind/k8s & every complex topic → real file → day):** [`deep-topics.md`](./deep-topics.md)
- **How AI helps at every step (AI-engineer track):** [`ai-engineer-track.md`](./ai-engineer-track.md)
- **Eraser.io diagram-as-code (product + diagrams):** [`eraser-architecture.md`](./eraser-architecture.md)
- **Day 2 recording script — architecture & the reasons:** [`day-02-architecture.md`](./day-02-architecture.md)

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

This is the **teaching order** (how we record), not the original build order. The product is
already built; each day we open one part of it, explain **why it's built that way**, and run the
**"The Difference"** segment (alternatives & why-not).

> **Day 1 — Demo (done).** We showed the finished World Cup 2026 Live Hub end to end: live
> scoreboard, ball-by-ball commentary, standings, news — every panel updating live. The hook:
> *"By Day 30 you'll know exactly how every box behind this works, and why we chose it."*
>
> **Day 2 — Architecture (today).** We build the whole system diagram live in **eraser.io** and walk
> the reason behind every box and every arrow. Full script: [`day-02-architecture.md`](./day-02-architecture.md).

### Phase 0 — Orientation (Days 1–2)
| Day | Teaching goal | The Difference |
|---|---|---|
| 1 | **Product demo** — tour the finished live hub; what each panel does; the promise of the series | Why a real product beats toy examples for learning architecture |
| 2 | **Architecture & the reasons** — draw the end-to-end diagram in eraser.io; explain every box/arrow; the request path & the real-time path | The whole system vs a single monolith app — and *why each tier exists* |

### Phase 1 — Foundations & data (Days 3–5)
| Day | Build goal | The Difference |
|---|---|---|
| 3 | FastAPI core service + Postgres; first endpoints (teams, fixtures); docker-compose | ORM vs raw SQL; container vs bare-metal |
| 4 | Match simulator service; ports/adapters (sim + real-API adapter) | Simulated vs real data source; why an abstraction boundary |
| 5 | Turborepo monorepo; shared packages; vertical-slicing concept | Monorepo vs polyrepo; vertical vs horizontal slicing |

### Phase 2 — Frontend & micro-frontends (Days 6–10)
| Day | Build goal | The Difference |
|---|---|---|
| 6 | Build the Shell host app (React + Vite + TS) | SPA shell vs server-stitched composition |
| 7 | Module Federation — expose first remote (Scoreboard) | Runtime MF vs build-time vs iframes |
| 8 | Add remotes (Match Center, Standings, News); shared deps & version skew | Shared singletons vs duplication; version mismatch handling |
| 9 | BFF tier (Node/Hono) — aggregation & shaping | BFF vs direct core-API calls vs GraphQL |
| 10 | Wire MFEs → BFF → core API end-to-end | Over-fetching vs tailored payloads |

### Phase 3 — Real-time (Days 11–15)
| Day | Build goal | The Difference |
|---|---|---|
| 11 | Standings via **polling** | Polling intervals vs freshness vs load |
| 12 | Match Center via **SSE** | SSE vs polling; reconnection semantics |
| 13 | Scoreboard via **WebSocket** | WS vs SSE; bidirectional cost |
| 14 | Redis pub/sub fan-out from simulator; scaling real-time | In-process vs broker fan-out; sticky sessions |
| 15 | Comparison episode: Polling vs SSE vs WebSocket | When to use which (decision framework) |

### Phase 4 — Edge, gateway & CDN (Days 16–21)
| Day | Build goal | The Difference |
|---|---|---|
| 16 | HTTPS / TLS termination (local certs) | Terminate at edge vs origin vs mTLS |
| 17 | API Gateway in a private network (VPC) | Private gateway vs direct exposure vs mesh |
| 18 | Edge Functions intro (wrangler/workerd local) | Edge vs origin vs regional serverless |
| 19 | Edge auth (JWT) + content negotiation | JWT-at-edge vs server sessions |
| 20 | Rate limiting at edge (token bucket, Redis) | Edge vs app-level vs none |
| 21 | CDN — caching, cache headers, SWR, asset versioning, image optimization | CDN vs origin serving; cache-busting |

### Phase 5 — Scaling & ops (Days 22–26)
| Day | Build goal | The Difference |
|---|---|---|
| 22 | Load balancing (Nginx/HAProxy, replicas, health checks, algorithms) | L7 vs L4; round-robin vs least-conn; DNS RR |
| 23 | Containerization deep dive (multi-stage builds, image size, security) | Multi-stage vs single-stage; distroless |
| 24 | Orchestration with k8s (kind) — Deployments, Services | Compose vs k8s |
| 25 | k8s scaling (app tier) — HPA, rolling updates, self-healing | Manual scaling vs HPA; rolling vs recreate |
| 26 | Scaling the data tier — Postgres primary + read replicas, read/write split | Single DB vs read replicas; replication lag & read-after-write; sync vs async |

### Phase 6 — Performance & finale (Days 27–30)
| Day | Build goal | The Difference |
|---|---|---|
| 27 | Core Web Vitals intro + measuring (Lighthouse, `web-vitals`) | Field vs lab metrics |
| 28 | **LCP** — initial render; SSR/streaming; image & font strategy | CSR vs SSR vs streaming |
| 29 | **CLS + INP** — layout stability with async micro-frontends; interaction responsiveness | Reserved space vs layout shift; heavy re-render vs memoization/concurrency |
| 30 | Finale — full system tour, recap, optional cloud-deploy teaser | Local vs real cloud (what changes) |
