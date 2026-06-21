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

**3. All five micro-frontends:**
```bash
cd worldcup-hub
pnpm build              # build remotes so remoteEntry.js exists (Module Federation)
pnpm preview            # shell:5000 + remotes:5001-5004
```

**Open http://localhost:5000** — live scoreboard (WebSocket), commentary (SSE), standings (polling),
news, and the Core Web Vitals HUD.

> Why `build` then `preview`? Module Federation in Vite is most reliable served from built output.
> For live-editing you can use `pnpm dev` instead, but rebuild remotes after changes.

Stop the backend: `cd worldcup-hub/infra/docker && docker compose down`.

---

## Using REAL match data (instead of the simulator)

By default the panels show the **simulator's** always-on matches. To use a **real football feed**,
flip the data source — thanks to the ports/adapters boundary, nothing else changes (same Redis
payload, same BFF, same UI).

**1. Get a free API token** at <https://www.football-data.org/client/register> (free tier: 10 req/min,
selected competitions).

**2. Tell the simulator to use it.** Create a `.env` next to the compose file:
```bash
cd worldcup-hub/infra/docker
cp .env.example .env
# edit .env:  DATA_SOURCE=real  and  FOOTBALL_API_KEY=<your token>
#             FOOTBALL_COMPETITION=WC   (or CL, PL, …)
docker compose up -d --build    # rebuild so the simulator picks up real mode
```
Or run the simulator locally with env vars:
```bash
cd worldcup-hub/services/simulator
DATA_SOURCE=real FOOTBALL_API_KEY=<token> FOOTBALL_COMPETITION=WC \
  REDIS_URL=redis://localhost:6379 ./.venv/bin/python -m uvicorn app.main:app --port 9000
```

**3. Run the BFF + frontends as usual** — the scoreboard now shows **real teams and live scores**.

**How it works:** in real mode the simulator polls
`GET /v4/competitions/{COMP}/matches` (header `X-Auth-Token`), normalises each match to the same
self-describing payload `{fixture_id, home, away, group, home_score, away_score, minute, status, text}`,
and publishes it to Redis — exactly the shape the simulator already emits. The BFF builds the
scoreboard, standings and commentary straight from those messages.

**Notes & limits:**
- Live matches only stream when a real match is **in play**. If none are live, the feed shows a few
  upcoming/recent fixtures (real teams) so the UI isn't empty.
- The free tier doesn't give minute-by-minute goal events, so the commentary feed is score/state
  updates rather than per-goal lines.
- Keep `POLL_INTERVAL >= 10` to respect the rate limit.
- Switch back anytime: set `DATA_SOURCE=sim` (or remove `.env`) and restart.
- Want a different provider (API-Football, TheSportsDB)? Add a new adapter alongside `real_api.py`
  implementing the same `fetch_live_states()` — the ports/adapters seam means that's the only file
  you touch.

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
