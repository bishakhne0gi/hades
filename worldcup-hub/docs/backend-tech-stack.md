<!-- Author: Bishakh -->

# Backend Tech Stack — explained from zero

This doc explains **every backend technology** in the World Cup hub, assuming you've never
heard of them. For each one: **what it is → why we use it → where it shows up in our code →
the alternative (the difference)**.

The request travels like this, and each tool owns one job:

```
HTTP request
  → Uvicorn        (receives the network request)
  → FastAPI        (routes it, validates input/output)
  → Pydantic       (checks the JSON is the right shape)
  → SQLAlchemy     (turns Python objects into SQL)
  → psycopg        (the driver that talks to Postgres)
  → PostgreSQL     (stores and returns the data)
```

---

## 1. Python

**What it is:** the programming language the backend is written in. Readable, batteries-included,
huge ecosystem for web and data work.

**Why we use it:** fast to write, easy to teach on camera, and FastAPI (below) is one of the best
modern web frameworks in any language.

**Where in our code:** every `.py` file under `services/core-api/app/` and `services/simulator/app/`.

**Version note:** the Docker images pin **Python 3.12** (stable, every library has wheels for it).
Your laptop happens to have 3.14, which is why the local virtual-env installs slightly newer
package versions — the Docker build is the "official" reproducible one.

**The difference:** alternatives are Node/TypeScript, Go, Java. We use Python for the core domain
services and (later) Node for the BFF — on purpose, so the series shows both worlds.

---

## 2. A "virtual environment" (`.venv`)

**What it is:** a private, throwaway folder of Python packages that belongs to **one project**, so
project A's libraries don't clash with project B's.

**Why we use it:** isolation. Without it, every `pip install` pollutes your whole machine.

**Where:** `services/core-api/.venv/` and `services/simulator/.venv/` (git-ignored — never committed).
We run tests with `./.venv/bin/python -m pytest`.

**The difference:** alternatives are Poetry, uv, conda. Plain `venv` ships with Python and is the
simplest to teach.

---

## 3. FastAPI — the web framework

**What it is:** the framework that turns Python functions into **HTTP API endpoints**. You write a
function, decorate it with `@app.get("/health")`, and it becomes a URL the world can call.

**Why we use it:** it's modern, extremely fast, and gives you three big freebies:
- **Automatic validation** of incoming JSON (via Pydantic).
- **Automatic API docs** — visit `/docs` and you get an interactive UI for free.
- **Dependency injection** — the `Depends(...)` mechanism that hands a database session to each
  request and cleans it up afterwards.

**Where in our code:**
```python
app = FastAPI(title="World Cup Hub — Core API")

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```
and every route in `app/routers/`.

**The difference:** Flask (older, fewer freebies, no built-in validation/async), Django
(heavyweight, batteries-included, more than we need), Express/Nest (Node world). FastAPI hits the
sweet spot for a typed, documented, async API.

---

## 4. Uvicorn — the server that runs FastAPI

**What it is:** an **ASGI server**. FastAPI describes *what* the endpoints do; Uvicorn is the program
that actually **listens on a port** (e.g. 8000), accepts network connections, and feeds requests to
FastAPI. (ASGI = the modern async "socket between web server and Python app".)

**Why we use it:** FastAPI can't run by itself — it needs a server to host it. Uvicorn is the
standard, async-capable choice.

**Where:** the last line of each `Dockerfile`:
```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
This means "run the `app` object found in `app/main.py`, listen on port 8000".

**The difference:** Gunicorn (older, sync-oriented; often used to *manage* multiple Uvicorn workers
in production), Hypercorn (another ASGI server). For dev and our containers, Uvicorn alone is fine.

---

## 5. Pydantic — data validation & the DTOs

**What it is:** a library that defines the **shape of data** with normal Python type hints, then
**validates and converts** real data against that shape. A class like `TeamCreate(name: str, code:
str, group: str)` becomes a rule: "the incoming JSON must have these fields, as strings".

**Why we use it:** it makes bad input impossible to ignore. If a client posts the wrong types,
FastAPI (using Pydantic) automatically returns a `422` error — you never write that check by hand.
These classes are our **DTOs** (Data Transfer Objects): the *contract* of the API, separate from how
we store data.

**Where in our code:** `app/schemas.py`:
```python
class TeamCreate(BaseModel):       # input DTO
    name: str
    code: str
    group: str

class TeamOut(BaseModel):           # output DTO
    model_config = ConfigDict(from_attributes=True)  # can read straight off an ORM object
    id: int
    name: str
    code: str
    group: str
```

**The difference:** you *could* validate by hand with `if/else` (error-prone), or use dataclasses
(no validation) or marshmallow (older). Pydantic is the standard and integrates natively with
FastAPI.

---

## 6. SQLAlchemy — the ORM ("alchemy")

This is the one you asked about. **SQLAlchemy is an ORM.**

**What is an ORM?** *Object–Relational Mapper.* A database stores data in **tables** (rows and
columns) and you talk to it with **SQL** (`SELECT * FROM teams WHERE code = 'ARG'`). An ORM lets you
work with **Python objects and classes instead of writing SQL by hand**. You define a class `Team`,
and SQLAlchemy:
- creates/maps it to a table called `teams`,
- turns `db.add(team)` into an `INSERT`,
- turns `select(Team)` into a `SELECT`,
- turns the rows that come back into `Team` Python objects.

So "alchemy" = the magic translator between **Python objects** ⇄ **database tables/SQL**.

**Why we use it:** you write Python, not raw SQL strings; it prevents whole classes of bugs (SQL
injection, typos), and it works across SQLite and Postgres with the *same* code — which is exactly
how we run SQLite in tests and Postgres in Docker.

**Where in our code:**
- `app/db.py` — the `engine` (the live connection pool) and `SessionLocal` (a factory for
  short-lived "sessions", where a **session = one unit of database work / transaction**).
- `app/models.py` — the classes that map to tables:
```python
class Team(Base):
    __tablename__ = "teams"
    id:    Mapped[int] = mapped_column(Integer, primary_key=True)
    name:  Mapped[str] = mapped_column(String(100), nullable=False)
    code:  Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    group: Mapped[str] = mapped_column(String(1), nullable=False)
```
  Each `mapped_column(...)` is one database column with its rules (type, length, unique, required).
- The routers use it to read/write:
```python
db.add(team); db.commit(); db.refresh(team)   # INSERT, save, reload the new id
list(db.scalars(select(Team)).all())          # SELECT * FROM teams
```

**Key vocabulary:**
- **Engine** — the pooled connection to the database (created once, reused).
- **Session** — your workspace for a single request: you stage changes, then `commit()` to save (or
  they roll back on error).
- **Model / entity** — a Python class mapped to a table (`Team`, `Fixture`).
- **Migration** — a versioned change to the table structure (we'll add **Alembic**, SQLAlchemy's
  migration tool, in a later phase; right now we auto-create tables on startup).

**The difference:** alternatives are **raw SQL** (full control, but verbose and risky), other ORMs
like **Django ORM** (tied to Django) or **Tortoise/SQLModel** (SQLModel is actually SQLAlchemy +
Pydantic combined). We use SQLAlchemy 2.x because it's the de-facto standard and teaches the real
concepts.

---

## 7. PostgreSQL — the production database

**What it is:** a powerful, open-source **relational database** (tables with strict columns,
relationships, transactions). "Relational" = data lives in tables that can reference each other
(a `fixture` references two `teams` by their id).

**Why we use it:** it's the industry default for serious apps — reliable, feature-rich, and it
supports the **read replicas** we teach in Phase 4 (one primary takes writes, replicas serve reads).

**Where:** the `postgres` service in `infra/docker/docker-compose.yml` (image `postgres:16`), and the
`DATABASE_URL` we pass to core-api:
```
postgresql+psycopg://worldcup:worldcup@postgres:5432/worldcup
```
Read as: *use Postgres (via the psycopg driver), user `worldcup`, password `worldcup`, host
`postgres`, port 5432, database `worldcup`.*

**The difference:** MySQL/MariaDB (also relational, slightly different feature set), SQLite (file-based,
great for dev/tests, not for production scale), MongoDB (a *non*-relational document store — wrong
fit for our structured fixtures/standings).

---

## 8. SQLite — the zero-setup database for tests/dev

**What it is:** a tiny relational database that lives in **a single file** (or even in memory) with
**no server to install**.

**Why we use it:** instant, dependency-free tests. Our test suite spins up an *in-memory* SQLite,
so tests are fast and leave nothing behind. Because we use SQLAlchemy, the **same model code** runs
on SQLite (tests) and Postgres (Docker).

**Where:** the default `DATABASE_URL` in `app/db.py` (`sqlite:///./dev.db`) and the in-memory engine
in `tests/conftest.py`.

**The difference:** Postgres is the real target; SQLite is the convenient stand-in. (We hit one
classic gotcha — in-memory SQLite needs a shared `StaticPool` so the test's background thread sees
the same database. That fix is in `conftest.py`.)

---

## 9. psycopg — the Postgres driver

**What it is:** the low-level Python **driver** that actually speaks Postgres's network protocol.
SQLAlchemy is the high-level translator; psycopg is the wire underneath it.

**Why we use it:** SQLAlchemy needs a driver to reach Postgres; `psycopg` (v3) is the modern one.
That's why the URL says `postgresql+psycopg://…` — "Postgres, using the psycopg driver".

**Where:** `requirements.txt` (`psycopg[binary]`) — `[binary]` means "ship precompiled, no compiler
needed".

**The difference:** `psycopg2` (the older v2), `asyncpg` (async-only). We use psycopg 3.

---

## 10. Docker — containers

**What it is:** a tool that packages an app **plus everything it needs** (Python version, libraries,
OS bits) into a single **image** that runs identically on any machine. A running image is a
**container** — a lightweight, isolated mini-computer.

**Why we use it:** "works on my machine" disappears. The same image runs on your laptop and in the
cloud. It also lets us run Postgres, core-api, and the simulator side by side without installing any
of them on your host OS.

**Where:** the `Dockerfile` in each service. Ours are **multi-stage**:
```dockerfile
FROM python:3.12-slim AS builder   # stage 1: install deps
...
FROM python:3.12-slim              # stage 2: copy only what's needed → smaller, safer image
```

**The difference:** running bare-metal on your host (the "works on my machine" trap), or a full
virtual machine (heavier, slower). Containers are the modern standard.

---

## 11. Docker Compose — running many containers together

**What it is:** a tool that starts **multiple containers as one stack** from a single YAML file,
wiring up their network, env vars, ports, and start order.

**Why we use it:** our app is several services (Postgres + core-api + simulator). Compose brings them
all up with one command and puts them on a private network where they find each other by name
(core-api reaches the DB at host `postgres`).

**Where:** `infra/docker/docker-compose.yml`. Notable bits:
- a **healthcheck** on Postgres, and `depends_on: condition: service_healthy` so core-api waits until
  the database is actually ready;
- a named **volume** `pgdata` so the database survives restarts;
- published **ports** (`8000`, `9000`) so you can reach the services from your browser.

Run it with `docker compose up -d --build`; stop with `docker compose down`.

**The difference:** starting each container by hand (tedious, error-prone), or jumping straight to
**Kubernetes** (much more powerful but far heavier — that's Phase 4, where we show *why* Compose
eventually isn't enough).

---

## 12. pytest + httpx — the testing tools

**What it is:**
- **pytest** — the test runner. Any function named `test_*` becomes a check; `assert` statements
  decide pass/fail.
- **httpx** — an HTTP client. FastAPI's `TestClient` uses it to call our endpoints **in-process**
  (no real network/server needed), so tests are fast and reliable.

**Why we use it:** we build with **TDD** — write a failing test first, then the code to pass it. The
8 passing tests are the safety net that lets us refactor fearlessly.

**Where:** `tests/` in each service, plus `tests/conftest.py` (shared fixtures like the in-memory DB
and a configured `client`).

**The difference:** `unittest` (Python's older, more verbose built-in), `requests` (sync HTTP, but
not wired into FastAPI's TestClient). pytest + httpx is the modern combo.

---

## 13. The simulator's pattern: Ports & Adapters

**What it is:** a *design pattern*, not a library. You define an interface (a **port**) — "anything
that can produce match events" — and write interchangeable implementations (**adapters**) behind it.

**Why we use it:** the match simulator can run off **fake data now** (`SimulatedSource`) and a **real
football feed later** (`RealApiSource`) without the rest of the app caring which one is plugged in.

**Where:** `services/simulator/app/ports.py` (the `MatchEventSource` protocol + `MatchEvent`),
`app/adapters/simulated.py`, `app/adapters/real_api.py`.

**The difference:** hard-coding the data source everywhere (then swapping it means rewriting the app).
The port/adapter boundary makes the swap a one-line change.

---

## 14. Coming in later phases (named now so they're not a surprise)

| Tool | Role | Phase |
|---|---|---|
| **Redis** | In-memory store for real-time pub/sub fan-out + rate-limit counters | 2 / 3 |
| **Node.js + Hono** | The BFF (Backend-for-Frontend) tier, owned by the frontend team | 1 |
| **Nginx / HAProxy** | Load balancer + API gateway | 3 / 4 |
| **Alembic** | SQLAlchemy's database migration tool (versioned schema changes) | later |
| **Kubernetes (kind)** | Container orchestration — autoscaling, self-healing, rolling updates | 4 |
| **Postgres read replicas** | Scale reads: primary takes writes, replicas serve reads | 4 |

---

## One-line cheat sheet

| Tool | One-liner |
|---|---|
| Python | the language |
| venv | per-project package sandbox |
| FastAPI | turns functions into API endpoints (+ validation + docs) |
| Uvicorn | the server that runs FastAPI on a port |
| Pydantic | validates JSON and defines the DTOs |
| SQLAlchemy | the ORM — Python objects ⇄ SQL tables |
| PostgreSQL | the real relational database |
| SQLite | tiny file/in-memory DB for tests |
| psycopg | the driver SQLAlchemy uses to reach Postgres |
| Docker | packages the app into a portable container |
| Docker Compose | runs the multi-container stack together |
| pytest / httpx | run tests / call endpoints in tests |
| Ports & Adapters | swap the simulator's data source without touching the app |
