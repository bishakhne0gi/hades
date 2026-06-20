<!-- Author: Bishakh -->

# Eraser.io Architecture — World Cup 2026 Live Hub

Paste the code blocks below into [eraser.io](https://eraser.io) (use a **Diagram-as-code** →
*Cloud Architecture Diagram* for the first, *Sequence Diagram* for the second).

## Product

**World Cup 2026 Live Hub** — a real-time web app for following the tournament live: live scores,
ball-by-ball commentary, lineups & stats, group standings, fixtures, and news/highlights. The UI is
composed from independently-deployed micro-frontends, each using the right real-time transport.

## End goal

- **Fans:** one fast, always-fresh place to follow every match — sub-second score updates,
  zero-refresh commentary, resilient under goal-moment traffic spikes.
- **Builder:** a single product that authentically exercises every architecture topic (the original 11 + database replication), built with AI.

---

## 1. Full End-to-End Architecture (eraser.io)

One diagram covering the whole system: **source/monorepo → build → container registry →
Kubernetes orchestration → runtime request path → data & real-time fan-out**. Each cluster maps to
the topics it teaches (see comments).

> This is the exact definition now live in the eraser.io workspace. Note: the API Gateway uses a
> distinct icon from the Load Balancer (so the two read as separate components), and Postgres is shown
> as **primary + two read replicas** to teach replication and read/write splitting.

```eraser
// World Cup 2026 Live Hub - End to End Architecture

Fan [icon: user]

Micro-frontends [icon: monitor, color: blue] {
  Shell Host [icon: react]
  Scoreboard WS [icon: react]
  Match Center SSE [icon: react]
  Standings Poll [icon: react]
  News CDN [icon: react]
}

Public Edge [icon: cloud, color: orange] {
  CDN Proxy [icon: cloudflare]
  Edge Worker [icon: cloudflare]
}

Kubernetes VPC [icon: kubernetes, color: green] {
  Load Balancer [icon: nginx]
  API Gateway [icon: aws-api-gateway]
  BFF [icon: nodejs]
  Core Services [icon: python, color: teal] {
    Fixtures Service [icon: python]
    Standings Service [icon: python]
    Commentary Service [icon: python]
  }
  Simulator [icon: python]
}

Data Stores [icon: database, color: purple] {
  Postgres Primary [icon: postgresql]
  Postgres Replica 1 [icon: postgresql]
  Postgres Replica 2 [icon: postgresql]
  Redis [icon: redis]
}

Build Pipeline [icon: github, color: gray] {
  Turborepo [icon: github]
  CI Build [icon: docker]
  Registry [icon: docker]
}

Turborepo > CI Build > Registry
Registry > Kubernetes VPC: deploy

Fan > Shell Host
Shell Host > Scoreboard WS
Shell Host > Match Center SSE
Shell Host > Standings Poll
Shell Host > News CDN
Shell Host > CDN Proxy
CDN Proxy > Edge Worker
Edge Worker > Load Balancer
Load Balancer > API Gateway
API Gateway > BFF
API Gateway > Core Services
BFF > Core Services

// Database replication: writes to primary, reads from a replica
Core Services > Postgres Primary: writes
Core Services > Postgres Replica 1: reads
Postgres Primary > Postgres Replica 1: replicate
Postgres Primary > Postgres Replica 2: replicate

Simulator > Postgres Primary: writes
Simulator > Redis: publish
Redis > Core Services: subscribe
Core Services > Scoreboard WS: WebSocket
Core Services > Match Center SSE: SSE
Edge Worker > Redis: rate limit
```

---

## 2. Real-time Sequence Diagram (eraser.io)

```eraser
title Real-time Fan-out — one simulator, three transports

Simulator > Redis: publish match.event (goal/card/sub)
Redis > Core Services: subscribers receive event
Core Services > Scoreboard (WS): push live score
Core Services > Match Center (SSE): stream commentary line
Standings (Poll) > Core Services: GET /standings every ~15s (cached)
Core Services > Standings (Poll): standings snapshot (SWR)
```

---

## 3. Request Lifecycle Sequence (eraser.io)

```eraser
title Request Lifecycle — cache → edge → VPC → origin

Browser > CDN: GET /api/match/123
CDN > Browser: cached response [if cache hit / SWR]
CDN > Edge Worker: forward [if cache miss]
Edge Worker > Edge Worker: TLS · verify JWT · rate-limit · negotiate
Edge Worker > Load Balancer: forward (private)
Load Balancer > API Gateway: route to healthy replica
API Gateway > BFF: MFE-shaped request
BFF > Core API: fetch fixtures + lineup + stats
Core API > Postgres: query
Postgres > Core API: rows
Core API > BFF: domain data
BFF > API Gateway: shaped payload
API Gateway > Edge Worker: response (+cache-control)
Edge Worker > CDN: response
CDN > Browser: response (now cached)
```

---

### Notes for drawing
- The **VPC group** is the teaching point: only the *Public Edge Layer* is exposed; everything inside
  the VPC has no public ports.
- Color the three **real-time transports** differently (WS / SSE / Polling) so the contrast pops on screen.
- The **Compose → Kubernetes** evolution (Phase 4) can be a second, simpler diagram: one box "Docker
  Compose (one network)" with an arrow to "Kubernetes (Deployments · HPA · rolling updates · self-heal)".
