<!-- Author: Bishakh -->

# Phase 3 — Edge, API Gateway & CDN

**Goal:** put a **public edge** in front of everything, keep the origin **private**, and add a **CDN**
for cacheable traffic. Cross-cutting concerns (TLS, auth, rate limiting, content negotiation, caching)
move to the edge so they happen **once, close to the user**, and bad traffic never reaches the origin.

## The request path now

```
Browser
  → CDN (Nginx)         cache GET + static assets, stale-while-revalidate, HIT/MISS header
  → Edge (Hono)         TLS · JWT auth · rate limit · content negotiation · edge cache
  → API Gateway (Nginx) single private door, routes /bff→bff, /api→core-api  [not host-published]
  → BFF / core-api      origin services on the private network
```

## What we built

### `services/edge` (Node/Hono) — the only public service
- **JWT auth** — verifies `Authorization: Bearer <token>` on JSON routes; rejects with **401** early.
  Streaming routes (`/bff/sse/*`, `/bff/ws/*`) are exempted (they auth via query/handshake).
  A dev-only `POST /edge/token` mints a demo token (production uses a real IdP — the edge only *verifies*).
- **Rate limiting** — in-memory **token bucket** per client (capacity 30, refill 3/s); returns **429 +
  Retry-After** under a burst (`rateLimit.ts`).
- **Content negotiation** — `/bff/standings` is served as **CSV** when the client sends
  `Accept: text/csv`, otherwise JSON.
- **Edge cache** — cacheable GETs (`/bff/standings`, `/bff/news`) cached for 5 s with an
  `X-Edge-Cache: HIT|MISS` header (`cache.ts`).
- **Streaming pass-through** — SSE responses are piped straight through, never cached.

### `infra/nginx/` — gateway, CDN, TLS (configs)
- `gateway.conf` — API gateway on `:8090`, routes `/bff/`→bff and `/api/`→core-api; **not published**
  to the host (only the edge reaches it) → that's the "API gateway lives in the VPC" topic.
- `cdn.conf` — caching reverse proxy on `:8081`: long immutable cache for `/assets/`, short TTL +
  `proxy_cache_use_stale ... updating` (stale-while-revalidate) for API responses, `X-CDN-Cache` header.
- `tls.conf` + `gen-certs.sh` — TLS termination on `:443` → plain HTTP to the edge (origins never do
  TLS work); HTTP→HTTPS redirect.

## Verified (live, with curl)

Ran BFF + edge locally:

| Check | Result |
|---|---|
| `GET /bff/standings` **without** token | **401** |
| `POST /edge/token` | returns a signed HS256 JWT |
| `GET /bff/standings` **with** token | **200**, `X-Edge-Cache: MISS` |
| same request again | `X-Edge-Cache: HIT` |
| `Accept: text/csv` | CSV body (`team,group,played,…`) |
| 40 rapid requests | **30× 200 + 10× 429** (`Retry-After: 1`) |

## The Difference

| Concern | At the edge (us) | Alternative | Why edge wins |
|---|---|---|---|
| TLS | terminate once at edge | terminate at each origin | origins skip TLS CPU; one cert to manage |
| Auth | JWT verified at edge | validate only at origin | bad traffic rejected before it costs origin |
| Rate limit | token bucket at edge | app-level limiter | abusers stopped before consuming origin |
| Caching | edge + CDN | origin-only / none | reads offloaded close to the user |
| Gateway | private, single door | expose services directly | one guarded entry, smaller attack surface |
| Content negotiation | once at edge | per service | no duplicated logic across services |

## Next (Phase 4)

Scale & ops: **load balancing** across multiple core-service replicas, full **Dockerization** of every
service (monorepo-aware images), a complete **docker-compose** stack, then **Kubernetes** (kind) with
HPA + rolling updates, and **Postgres primary + read replicas**.
