<!-- Author: Bishakh -->

# Design — World Cup 2026 Live Hub (30-Day Architecture Challenge)

**Date:** 2026-06-21
**Status:** Approved (architecture); ready for implementation planning of Phase 0.

## Purpose

Build one end-to-end product — a live **World Cup 2026 hub** — as the teaching vehicle for a 30-day
YouTube build series covering modern frontend & platform architecture. Each episode adds one
increment and explains **the difference**: the alternatives that exist and why we chose what we chose.
Secondary goal: the creator learns these technologies by building them.

## Locked decisions

- **Product:** World Cup 2026 live hub (scores, match center, standings, news/highlights).
- **Infra realism:** local-first with real tools; Docker Compose first, graduate to kind/k8s.
- **Match data:** simulator service + real-API adapter behind a ports/adapters boundary.
- **Frontend:** Module Federation micro-frontends in a Turborepo monorepo; React + Vite + TypeScript.
- **BFF:** Node/TypeScript (Hono), owned by the frontend; core domain stays FastAPI.
- **Core backend:** FastAPI + Postgres; Redis for real-time pub/sub fan-out and rate-limit buckets.

## Architecture

Full topology, request lifecycle, real-time fan-out, deployment evolution, repo structure and the
topic→component map are documented with Mermaid diagrams in:

- `tutorials/architecture.md` — diagrams + repo layout + topic map
- `tutorials/the-difference.md` — alternatives & why-not for every topic
- `tutorials/README.md` — locked decisions + the 30-day episode map
- `tutorials/ai-engineer-track.md` — how AI assists each phase + the "AI co-pilot" episode beat

**Tiers (each a container; only the edge layer is public):**
Browser → CDN proxy → Edge worker (TLS, JWT auth, rate limit, content negotiation, edge cache) →
Load Balancer (spreads traffic across replicas) → API Gateway (single private door into the "VPC";
distinct from the LB) → { BFF (Node/Hono), Core services (FastAPI) } →
Postgres (primary + read replicas) + Redis + Match simulator.

**Micro-frontends:** a Shell host loads four remotes via Module Federation — Scoreboard (WebSocket),
Match Center (SSE), Standings (polling), News/Highlights (CDN/static). Each is vertically sliced:
it owns its UI, its BFF route, and its data domain.

## Components (single responsibility each)

| Unit | Responsibility | Depends on |
|---|---|---|
| `core-api` (FastAPI) | Domain data: teams, fixtures, results, standings, commentary; routes writes→primary, reads→replica | Postgres (primary + replicas), Redis |
| `simulator` (FastAPI) | Stream realistic match events; adapter for a real feed; writes to primary | Redis, Postgres primary |
| `bff` (Node/Hono) | Aggregate + shape data per micro-frontend | core-api |
| `shell` (React) | Routing, layout, shared deps, error boundaries; loads remotes | remotes via MF |
| `mfe-*` (React) | One panel each; one real-time transport each | bff |
| `edge` | TLS, JWT auth, rate limit, content negotiation, edge cache | Redis |
| `lb` | Load balancing across core-service replicas + health checks (distinct from gateway) | core |
| `gateway` | Single private routing/policy door into the VPC (distinct from LB) | core, bff |
| `cdn` | Asset + cacheable-response caching with SWR | edge |
| `postgres` | Primary takes all writes; read replicas serve reads via streaming replication | — |
| `infra/docker`, `infra/k8s` | Compose first, then kind/k8s manifests + HPA (app tier) + replica topology (data tier) | all services |

## Data flow

Simulator publishes `match.event` to Redis → core-api subscribers fan out → WebSocket pushes scores,
SSE streams commentary, polling fetches cached standings. Reads flow back through gateway → edge →
CDN with cache-control headers and stale-while-revalidate.

**Database path:** all writes (core-api, simulator) go to the **Postgres primary**; the primary
streams changes to **read replicas**, which serve the read-heavy query load. core-api owns the
read/write split, and the spec accepts (and demonstrates) **replication lag** as the trade-off.

## Error handling

- Shell renders per-remote error boundaries so one failed micro-frontend never blanks the page.
- BFF degrades gracefully (partial payloads) when a core service is slow/unavailable.
- Edge rejects unauthenticated/over-limit traffic before it reaches origin.
- k8s liveness/readiness probes + LB health checks remove unhealthy replicas.

## Testing

- Core-api & simulator: pytest (unit + endpoint tests), TDD per feature.
- BFF & MFEs: vitest + component tests; contract tests on the BFF↔MFE shared types.
- Infra: smoke tests via Compose (services come up, end-to-end request succeeds).

## Scope & sequencing

The full series is 30 days across 6 phases (see `tutorials/README.md`). It is **decomposed into
sub-projects**; each phase gets its own spec → plan → implementation cycle. This document is the
program-level design. **Next sub-project to plan: Phase 0 (Days 1–3)** — core-api + Postgres +
simulator + first docker-compose.

## Out of scope (for now)

Real cloud deployment (optional Day-30 teaser only), real authentication provider, payments,
betting/odds, native mobile apps.
