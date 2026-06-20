<!-- Author: Bishakh -->

# The AI-Engineer Track — building this *with* AI

A parallel thread running through all 30 days: every episode shows **how AI helps at each step** and
**which judgment stays human**. The arc: you start at "0.1% AI engineer" (AI writes, you copy) and end
able to *direct* AI across a real distributed system — specs, scaffolding, tests, debugging, review.

## The core principle: AI accelerates, you decide

| AI is great at | You must own |
|---|---|
| Scaffolding boilerplate (Dockerfiles, configs, CRUD endpoints) | Architecture & the "why" behind each choice |
| Explaining a concept / generating "the difference" comparisons | Verifying the explanation is actually true |
| Writing tests from a spec; generating edge cases | Deciding what "correct" means |
| Debugging from logs/stack traces | Reproducing and confirming the real root cause |
| Drafting diagrams, docs, commit messages | Judgment on trade-offs, security, and scope |

**Rule of the series:** never ship AI output you can't explain on camera. AI drafts → you verify → you teach it.

## How AI helps, phase by phase

| Phase | AI does the heavy lifting on | You practice (the AI-engineer skill) |
|---|---|---|
| **0 — Foundations** | Generate FastAPI scaffolding, SQLAlchemy models, docker-compose, the simulator's event loop | Writing a precise spec/prompt; reviewing generated SQL; ports/adapters design |
| **1 — Micro-frontends** | Turborepo config, Module Federation `vite.config`, shared-dep wiring, remote scaffolds | Catching version-skew bugs AI misses; deciding slice boundaries |
| **2 — Real-time** | WebSocket/SSE/polling handlers, Redis pub/sub glue, reconnection logic | Judging which transport fits; load-testing AI's code |
| **3 — Edge / gateway / CDN** | Nginx/edge configs, JWT middleware, rate-limit token bucket, cache headers | Reading configs critically; verifying auth actually rejects bad traffic |
| **4 — Scaling / ops** | Dockerfiles, k8s manifests, HPA, LB config, Postgres replica setup + read/write-split wiring | Deciding probes/limits; confirming rolling updates self-heal; spotting replication-lag bugs AI's read/write split misses |
| **5 — Core Web Vitals** | `web-vitals` instrumentation, suggested LCP/CLS/INP fixes | Measuring before/after; rejecting "optimizations" that don't move metrics |

## Per-episode "AI co-pilot" segment

Each video gets a short recurring beat alongside "The Difference":

1. **Prompt** — the actual spec/prompt given to the AI (shown on screen).
2. **Generate** — what it produced.
3. **Verify** — how we checked it (tests, run it, read it) — *the most important part*.
4. **Correct** — where AI was wrong/incomplete and how we fixed it.
5. **Learn** — the AI-engineering skill that episode reinforced.

## The "0.1% → AI engineer" growth ladder

Concrete capabilities the viewer (and creator) build up:

1. **Prompt as spec** — turn a fuzzy idea into a precise, testable instruction.
2. **Verify by default** — never trust un-run code; tests and reproduction over vibes.
3. **Decompose** — break a system so AI can work one well-bounded unit at a time.
4. **Review AI like a senior** — spot security holes, wrong abstractions, missing edge cases.
5. **Debug with AI** — feed it the right context (logs, repro) instead of guessing.
6. **Orchestrate** — direct AI across many services while keeping the architecture coherent in your head.

> The honest framing for the channel: AI makes the *typing* fast; the engineering — judgment,
> verification, system design — is still yours. This series trains that.

See [`README.md`](./README.md) for the day-by-day map and [`the-difference.md`](./the-difference.md) for the alternatives table.
