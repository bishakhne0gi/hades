<!-- Author: Bishakh -->

# Phase 2 — Real-time (Polling vs SSE vs WebSocket)

**Goal:** make the hub *live*. One simulator drives a never-ending feed; three panels each consume
it with a **different transport**, so a single product showcases all three side by side.

## The pipeline

```
simulator (Python)                Redis                 BFF (Node/Hono)            browser
 plays fixtures, publishes  ──▶  pub/sub  ──▶  subscribes, keeps live state  ──▶  Scoreboard  (WebSocket)
 each MatchEvent every 0.5s     "match.events"   + commentary buffer          ──▶  Match Center (SSE)
                                                                              ──▶  Standings   (polling)
```

- **Simulator** (`app/realtime.py`): on startup it launches an asyncio task per fixture that replays
  the deterministic `SimulatedSource` forever, publishing each event to the Redis channel
  `match.events` (a kickoff event marks a fresh match → score reset). No-ops if Redis is absent.
- **Redis** is the **fan-out bus**. Decoupling the simulator from the BFF this way is what lets you
  run *many* BFF instances later — every instance subscribes and all clients stay in sync. (That's
  the difference vs an in-process emitter, which can't scale past one process.)
- **BFF** (`src/realtime.ts`) subscribes once, maintains in-memory **live scores** + a **commentary
  buffer** per fixture, and re-emits on an `EventEmitter` bus that the transport routes listen to.

## The three transports — one per panel, on purpose

| Panel | Transport | BFF route | Why this transport |
|---|---|---|---|
| **Scoreboard** | **WebSocket** | `GET /bff/ws/scoreboard` | scores change often and we want instant, low-latency pushes; bidirectional channel |
| **Match Center** | **SSE** | `GET /bff/sse/match/:id` | commentary is one-way server→client; SSE is HTTP-native, auto-reconnects, no socket upkeep |
| **Standings** | **Polling** | `GET /bff/standings` (client `setInterval` 8s) | changes slowly; a periodic re-fetch is simplest and cache-friendly |

## Verified (live, end-to-end)

Ran Redis + simulator + BFF locally and observed real traffic:
- **SSE** `/bff/sse/match/1` streamed: `kickoff` → `commentary` → `GOAL for AWAY!` (live).
- **WebSocket** `/bff/ws/scoreboard` pushed snapshots: `ARG 0:1 BRA · 85' · live`, updating on change.
- **Redis** carried the `match.events` channel between the two services.

```bash
# reproduce locally
docker run -d --name wc-redis -p 6379:6379 redis:7-alpine
cd services/simulator && REDIS_URL=redis://localhost:6379 ./.venv/bin/python -m uvicorn app.main:app --port 9000
cd services/bff && REDIS_URL=redis://localhost:6379 PORT=8080 node dist/index.js
# then: curl -N http://localhost:8080/bff/sse/match/1
```

`docker-compose.yml` now includes a **redis** service and passes `REDIS_URL` to the simulator. (The
BFF joins compose in Phase 4 with a monorepo-aware image; for now run it with `pnpm --filter @wc/bff dev`.)

## The Difference (when to use which)

| | Polling | SSE | WebSocket |
|---|---|---|---|
| Direction | client pulls | server → client | bidirectional |
| Transport | plain HTTP | HTTP (text/event-stream) | ws:// upgrade |
| Reconnect | trivial (next poll) | automatic (built-in) | manual |
| Latency | poll-interval lag | low | lowest |
| Cost/complexity | lowest | low | highest (stateful sockets) |
| Best for | slow data (standings) | one-way feeds (commentary, notifications) | high-rate, two-way (scores, chat) |

**The trap we avoid:** using one transport for everything. Polling the scoreboard every second wastes
requests and still lags; opening a WebSocket for slow standings is needless socket overhead. Match the
transport to the data.

## Next (Phase 3)

Put a **public edge** in front: TLS termination, JWT auth, rate limiting and content negotiation at
the edge, an **API gateway** inside a private network, and a **CDN** for cacheable assets/responses.
