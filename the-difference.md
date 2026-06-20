<!-- Author: Bishakh -->

# "The Difference" — alternatives & why-not for every topic

The recurring spine of the series:
**here's the naive way → here's why it breaks → here's what we use → the trade-off we accepted.**

| Topic | What we use | Main alternatives | Why not (here) |
|---|---|---|---|
| **1. Micro-frontend** | Module Federation (runtime) | Single SPA monolith; iframes; Web Components / single-spa; build-time integration | Monolith = no independent deploys (the whole point); iframes isolate too hard (no shared state/routing, bad UX); build-time integration couples release cycles. MF gives true runtime independence. |
| **2. Monorepo + vertical slicing** | Turborepo, slice by feature/team | Polyrepo; Nx; horizontal slicing (by layer) | Polyrepo = painful cross-cutting changes + version drift for a solo creator; Nx heavier/more opinionated than needed; horizontal slicing spreads one feature across many owners → no clear ownership. |
| **3. Edge Functions** | Edge worker (V8-isolate style; local via wrangler/workerd) | Do it all in origin; CDN-only with no compute; regional serverless (Lambda) | Origin = latency + load for auth/rate-limit; CDN-only can't run logic; regional serverless is near user but not *at* the edge. |
| **3a. Caching** | Edge + CDN cache w/ SWR | No cache; app-only cache; DB-only cache | No cache = origin overload; app-only misses CDN offload; we cover cache layers + invalidation trade-offs. |
| **3b. HTTPS / TLS** | Terminate at edge | Terminate at origin; full mTLS everywhere | Origin termination wastes CPU + plaintext hops; full mTLS overkill for a public read-heavy app. |
| **3c. Auth** | JWT validated at edge | Server sessions + central store; validate only at origin | Sessions need shared store + sticky routing (hurts scaling); origin-only lets bad traffic in. JWT-at-edge rejects early, stateless. |
| **3d. Content negotiation** | At edge (Accept / Accept-Encoding / lang) | Per-service negotiation; ignore it | Per-service duplicates logic; ignoring it = no compression/format/locale flexibility. |
| **3e. Rate limiting** | Token bucket at edge (Redis) | App-level limiter; none; LB-level | App-level = abusers already hit origin; none = DoS risk; edge stops floods before they cost you. |
| **4. API Gateway in VPC** | Private gateway, no public ports | Expose services directly; service mesh (Istio); public gateway | Direct exposure = huge attack surface; full mesh too heavy to teach early; private gateway = one guarded door. |
| **5. Load Balancing** | L7 Nginx/HAProxy, multiple replicas | Single instance; DNS round-robin; L4 only; client-side LB | Single = no HA/scale; DNS RR has no health awareness; L4 can't route by path/header. We show L7 + health checks + algorithm choice. |
| **6. Containers** | Docker multi-stage | Bare-metal/venv; single-stage images; Buildpacks | Bare-metal = "works on my machine"; single-stage = bloated/insecure images. We contrast image size & layers. |
| **7. Orchestration** | k8s via kind | Docker Compose only; Swarm; Nomad; "just run it" | Compose = no self-healing/autoscale/rolling updates; Swarm/Nomad less industry-standard. We show why Compose stops being enough. |
| **8. BFF** | Node/TS per-frontend BFF | Frontend → core API directly; one shared API-for-all; GraphQL gateway | Direct = over-fetching + chatty + leaks domain shape; one-size API serves no client well; GraphQL named & contrasted vs BFF. |
| **9. CDN** | Caching proxy + versioned assets | Serve from origin; no asset hashing; inline everything | Origin serving = slow + costly far from users; no hashing = stale-cache bugs. We show cache-busting + image optimization. |
| **10. Core Web Vitals** | Measure + fix LCP / INP / CLS | Ignore perf; optimize blindly; lab-only metrics | "Looks fast" ≠ measured; we show field vs lab data and how async micro-frontends specifically threaten CLS/LCP. |
| **11. Real-time** | Polling + SSE + WebSocket (one each) | One transport everywhere; long-polling; WebRTC | Forcing one transport everywhere is the #1 mistake; we prove per-use-case selection. WebRTC = wrong tool (P2P media). |
| **12. DB replication & read scaling** | Postgres primary (writes) + read replicas (reads), async streaming replication | Single database; sharding; multi-primary; caching only | Single DB = reads + writes contend and one node caps throughput (bad for a read-heavy hub); sharding/multi-primary add big complexity we don't yet need; cache-only ignores the source of truth. Read replicas scale reads cheaply — trade-off: **replication lag** (read-after-write can be stale), which we show and handle. |
