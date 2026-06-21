<!-- Author: Bishakh -->

# Running the World Cup 2026 Live Hub

Prerequisites: **Docker** running, **Node 20+**, **pnpm**.

## Ports at a glance

| Service | Port | Tier |
|---|---|---|
| Postgres | 5432 | infra |
| Redis | 6379 | infra |
| core-api (FastAPI) | 8000 | backend |
| simulator (FastAPI) | 9000 | backend |
| BFF (Hono) | 8080 | backend-for-frontend |
| edge (Hono) | 8888 | edge (optional) |
| shell (host) | 5000 | frontend |
| scoreboard / match-center / standings / news | 5001–5004 | micro-frontends |
| CDN (compose.full only) | 8081 | edge infra |

---

## Recommended: 3-terminal local run

**1. Backend infra (Docker)** — Postgres, Redis, core-api, simulator:
```bash
cd worldcup-hub/infra/docker
docker compose up -d
```
The simulator starts publishing live match events to Redis right away.

**2. The BFF:**
```bash
cd worldcup-hub
pnpm install            # first time only
pnpm --filter @wc/bff dev
```

**3. All five micro-frontends — with hot reload (HMR):**
```bash
cd worldcup-hub
pnpm install            # first time only
pnpm dev:web            # shell:5000 + remotes:5001-5004, all with HMR
```

**Open http://localhost:5000** — live scoreboard (WebSocket), commentary (SSE), standings (polling),
news, and the Core Web Vitals HUD. Edit any micro-frontend (or the shell) and the change hot-reloads
instantly — no rebuild.

> We use **`@module-federation/vite`**, which runs the host *and* remotes under `vite dev` with HMR
> (the older `@originjs` plugin couldn't run the host in dev). For a production-like build instead,
> use `pnpm build && pnpm preview`.

Stop the backend: `cd worldcup-hub/infra/docker && docker compose down`.

---

## Using REAL match data (instead of the simulator)

By default the panels show the **simulator's** always-on matches. To use real data, flip the data
source — thanks to the ports/adapters boundary nothing else changes (same Redis payload, BFF, UI).
The Match Center auto-picks whatever the first live fixture is.

### Option A — football-data.org → FIFA World Cup 2026 (recommended for the World Cup)

Best free, reliable source for the World Cup: its **free tier includes the World Cup (WC)** —
fixtures, results, and **group standings** — committed free, 10 req/min.

1. Get a free token (quick email signup) at <https://www.football-data.org/client/register>.
2. Configure it:
```bash
cd worldcup-hub/infra/docker
cp .env.example .env      # set DATA_SOURCE=real, FOOTBALL_API_KEY=<token>, FOOTBALL_COMPETITION=WC
docker compose up -d --build
```
Or run the simulator locally:
```bash
cd worldcup-hub/services/simulator
DATA_SOURCE=real FOOTBALL_API_KEY=<token> FOOTBALL_COMPETITION=WC \
  REDIS_URL=redis://localhost:6379 ./.venv/bin/python -m uvicorn app.main:app --port 9000
```
You get **real national teams, real scores, and the group letter** (e.g. `ARG`, group `A`). Live
scores stream while a match is **in play**; otherwise it shows upcoming/recent WC fixtures. The World
Cup runs **11 Jun – 19 Jul 2026**, so live data flows during the tournament.

> Other WC-specific free options researched: **worldcup26.ir** (open-source, all 104 matches +
> groups + live scores; free but needs a JWT registration) and **TheStatsAPI** (free fixtures
> download + 7-day trial). football-data.org wins on reliability + zero-cost standings.

### Option B — TheSportsDB (REAL data, **no key**, but not ideal for the WC)

Good for an instant, signup-free demo of *any* league — but its free test key caps results, so it's
weak for the World Cup. Use it to see real data flow without registering:
```bash
cd worldcup-hub/services/simulator
DATA_SOURCE=thesportsdb THESPORTSDB_LEAGUE=4328 REDIS_URL=redis://localhost:6379 \
  ./.venv/bin/python -m uvicorn app.main:app --port 9000   # 4328 = Premier League
```

### Notes
- **After switching sources, restart the simulator and BFF** (or wait ~90 s — the BFF evicts fixtures
  whose source has gone quiet, so stale matches drop off automatically).
- Keep `POLL_INTERVAL >= 10` to respect free-tier rate limits.
- Switch back: `DATA_SOURCE=sim` (or remove `.env`) and restart.
- Add another provider (API-Football, …)? Drop a new adapter next to `thesportsdb.py`/`real_api.py`
  implementing the same `fetch_live_states()` — that's the only file you touch.

## Optional: the edge (Phase 3)

The browser app calls the BFF directly. The edge (JWT auth, rate limit, content negotiation, cache)
is best demoed with curl, since it requires a token the UI doesn't send:
```bash
pnpm --filter @wc/edge dev          # :8888
TOKEN=$(curl -s -X POST http://localhost:8888/edge/token | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8888/bff/standings -D - | grep -i x-edge-cache
curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: text/csv" http://localhost:8888/bff/standings
```

---

## Optional: full production-like infra (Phase 4)

Edge + gateway + L7 LB + CDN + 2 core-api replicas + Postgres primary/replica:
```bash
cd worldcup-hub/infra/docker
docker compose -f compose.full.yml up -d --build    # public entry via CDN at :8081
```
Run the frontends with `pnpm preview` as above.

## Optional: Kubernetes (Phase 4)
```bash
brew install kind && kind create cluster
# build + load images:
docker build -t worldcup-core-api ../../services/core-api
docker build -t worldcup-simulator ../../services/simulator
docker build -f ../../services/bff/Dockerfile  -t worldcup-bff  ../..
docker build -f ../../services/edge/Dockerfile -t worldcup-edge ../..
kind load docker-image worldcup-core-api worldcup-simulator worldcup-bff worldcup-edge
kubectl apply -f infra/k8s/
kubectl -n worldcup get pods,hpa
```

---

## Troubleshooting

- **Scoreboard not updating** → the BFF needs Redis. Confirm `docker compose ps` shows `redis` up, and
  the BFF log prints `subscribed to 'match.events'`.
- **Blank panels / remote "unavailable"** → run `pnpm build` before `pnpm preview` so each remote's
  `remoteEntry.js` exists.
- **Port already in use** → another process holds 5000–5004/8080; stop it or change the port in the
  app's `package.json` script.
- **`pnpm preview` shows old code** → rebuild: `pnpm build`.
