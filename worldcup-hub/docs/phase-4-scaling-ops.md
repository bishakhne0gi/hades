<!-- Author: Bishakh -->

# Phase 4 — Scaling & Ops (Containers, Load Balancing, Kubernetes, DB replicas)

**Goal:** take the working system and make it *scale and self-heal* — containerize everything, load
balance across replicas, orchestrate with Kubernetes, and split the database into a **primary + read
replica**.

## What we added

### 1. Database read/write split (app tier)
`core-api` now opens **two** engines (`app/db/session.py`):
- `engine` / `get_db` → **primary** (`DATABASE_URL`) for **writes**.
- `read_engine` / `get_read_db` → **replica** (`READ_DATABASE_URL`) for **reads**.

The routes wire writes through `get_*_service` (primary) and reads through `get_*_read_service`
(replica). Because the layering already isolated DB access in the repository, this was a small,
surgical change — exactly what the layers are for.

### 2. Monorepo-aware container images
`services/bff/Dockerfile` and `services/edge/Dockerfile` build from the **monorepo root** so pnpm can
resolve workspace packages (`@wc/types`), then use `pnpm deploy --prod` to emit a small, self-contained
runtime image (multi-stage: build → slim runtime).

### 3. Load balancing
`infra/nginx/lb.conf` — an L7 load balancer (`least_conn`, health-aware `max_fails`/`fail_timeout`,
transparent `proxy_next_upstream` retry) across two core-api replicas. In Kubernetes, the **Service**
itself is the load balancer.

### 4. The complete stack — `infra/docker/compose.full.yml`
11 services wired end to end:
`cdn → edge → gateway → lb → core-api-1/2 → postgres-primary/replica`, plus `redis`, `simulator`, `bff`.
Postgres uses **bitnami/postgresql** streaming replication (`master`/`slave` mode).

### 5. Kubernetes manifests — `infra/k8s/`
16 resources: Namespace; Redis; Postgres primary + replica; **core-api Deployment (2 replicas) +
Service + HPA** (CPU 70%, 2→6 pods); simulator/bff/edge Deployments + Services; edge exposed via
NodePort. Liveness/readiness probes on core-api so k8s self-heals and gates rollouts.

## How to run

```bash
# Full stack via Compose
cd infra/docker && docker compose -f compose.full.yml up -d --build
curl http://localhost:8081/...        # through the CDN → edge → gateway → lb → core-api

# Kubernetes (needs a cluster, e.g. kind)
brew install kind && kind create cluster
# build images and load them into kind:
docker build -t worldcup-core-api ../../services/core-api
docker build -t worldcup-simulator ../../services/simulator
docker build -f ../../services/bff/Dockerfile  -t worldcup-bff  ../..
docker build -f ../../services/edge/Dockerfile -t worldcup-edge ../..
kind load docker-image worldcup-core-api worldcup-simulator worldcup-bff worldcup-edge
kubectl apply -f infra/k8s/
kubectl -n worldcup get pods,hpa
```

## Verified

- **core-api read/write split**: a dedicated test binds primary + replica to *separate* in-memory DBs
  and asserts a write to the primary is **not** visible via the replica → **13/13 tests pass**.
- **Monorepo BFF/edge images**: multi-stage Dockerfiles using `pnpm deploy --prod` from the repo
  root (build context resolves `@wc/types`). The first build runs a full in-container `pnpm install`
  so it's slow; build with `docker build -f services/bff/Dockerfile -t worldcup-bff ..`.
- **`compose.full.yml`** validates: `docker compose config` → **11 services** (incl. both core-api
  replicas via a YAML anchor).
- **k8s manifests**: **16 well-formed resources** across 4 ordered files (parsed + kinds confirmed).

> `kind` isn't installed in this environment, so the live cluster apply is the one step you run
> locally (`brew install kind`). The manifests, images, and probes are all in place.

## The Difference

| Concern | We chose | Instead of | Why |
|---|---|---|---|
| Orchestration | Kubernetes (kind) | Compose-only | self-healing, HPA autoscaling, rolling updates |
| Scaling app | HPA 2→6 on CPU | manual replica count | reacts to load automatically |
| Load balancing | L7 (nginx / k8s Service) | single instance / DNS RR | health-aware, least-conn, retries |
| DB scale | primary + read replica | single database | reads scale off the primary (read-heavy hub) |
| Images | multi-stage + `pnpm deploy` | single-stage / whole monorepo | small, prod-only runtime image |

**Trade-off we accept (DB replicas):** asynchronous replication means a read right after a write can
be **stale** (replication lag). For a live scores hub that's fine for standings/news; anything needing
read-after-write consistency reads from the primary.

## Next (Phase 5)

Performance: measure and fix **Core Web Vitals** (LCP, INP, CLS) with `web-vitals` + Lighthouse, and
address how async micro-frontends specifically affect layout stability and interaction latency.
