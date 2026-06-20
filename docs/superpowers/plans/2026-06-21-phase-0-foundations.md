<!-- Author: Bishakh -->

# Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the backend foundation of the World Cup 2026 Live Hub — a FastAPI `core-api` backed by Postgres (teams + fixtures) and a `simulator` service that streams match events behind a ports/adapters boundary — all runnable via one `docker-compose up`.

**Architecture:** Two independent Python services under `worldcup-hub/services/`. `core-api` owns domain data in Postgres via SQLAlchemy and exposes REST endpoints. `simulator` generates realistic match events through a `MatchEventSource` port with a simulated adapter now and a real-API adapter stub for later. Docker Compose wires Postgres + both services on one network.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, Uvicorn, pytest, httpx (TestClient), Docker, Docker Compose, Postgres 16.

## Global Constraints

- Every file created includes an author comment as its first line: `# Author: Bishakh` (Python), `# Author: Bishakh` (YAML/Dockerfile). Use the language-appropriate comment syntax; the text is always `Author: Bishakh`.
- Python version floor: 3.12.
- All work lives under `worldcup-hub/` at the repo root (`/Users/bishashcosx/Documents/Codes/personal/claude-test/worldcup-hub/`).
- Unit/endpoint tests use SQLite in-memory (via dependency override) for speed; Postgres is used only by the running Compose stack. Models must stay portable between the two.
- TDD throughout: failing test first, minimal implementation, passing test, commit.
- Today's date for any timestamps in commits/docs: 2026-06-21.

---

### Task 1: `core-api` scaffold + health endpoint

**Files:**
- Create: `worldcup-hub/services/core-api/app/__init__.py`
- Create: `worldcup-hub/services/core-api/app/main.py`
- Create: `worldcup-hub/services/core-api/requirements.txt`
- Create: `worldcup-hub/services/core-api/pytest.ini`
- Create: `worldcup-hub/services/core-api/tests/__init__.py`
- Test: `worldcup-hub/services/core-api/tests/test_health.py`

**Interfaces:**
- Produces: a FastAPI app object `app` importable as `from app.main import app`; a `GET /health` endpoint returning `{"status": "ok"}`.

- [ ] **Step 1: Create `requirements.txt`**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
sqlalchemy==2.0.36
pydantic==2.10.3
httpx==0.28.1
psycopg[binary]==3.2.3
pytest==8.3.4
```

- [ ] **Step 2: Create `pytest.ini`**

```ini
# Author: Bishakh
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 3: Create empty package files**

`app/__init__.py` and `tests/__init__.py` each contain a single line:

```python
# Author: Bishakh
```

- [ ] **Step 4: Write the failing test**

`tests/test_health.py`:

```python
# Author: Bishakh
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 5: Run test to verify it fails**

Run (from `worldcup-hub/services/core-api/`, with a venv that has requirements installed): `pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 6: Write minimal implementation**

`app/main.py`:

```python
# Author: Bishakh
from fastapi import FastAPI

app = FastAPI(title="World Cup Hub — Core API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add worldcup-hub/services/core-api
git commit -m "feat(core-api): scaffold FastAPI app with health endpoint"
```

---

### Task 2: Database layer + `Team` model + teams endpoints

**Files:**
- Create: `worldcup-hub/services/core-api/app/db.py`
- Create: `worldcup-hub/services/core-api/app/models.py`
- Create: `worldcup-hub/services/core-api/app/schemas.py`
- Create: `worldcup-hub/services/core-api/app/routers/__init__.py`
- Create: `worldcup-hub/services/core-api/app/routers/teams.py`
- Modify: `worldcup-hub/services/core-api/app/main.py`
- Create: `worldcup-hub/services/core-api/tests/conftest.py`
- Test: `worldcup-hub/services/core-api/tests/test_teams.py`

**Interfaces:**
- Produces:
  - `Base` (SQLAlchemy declarative base) in `app/db.py`
  - `get_db()` FastAPI dependency yielding a `Session` in `app/db.py`
  - `engine` and `SessionLocal` in `app/db.py`, configured from env var `DATABASE_URL` (default `sqlite:///./dev.db`)
  - `Team` model in `app/models.py` with columns: `id: int (pk)`, `name: str`, `code: str (3-letter, unique)`, `group: str`
  - Pydantic `TeamCreate {name, code, group}` and `TeamOut {id, name, code, group}` in `app/schemas.py`
  - Endpoints: `POST /teams` (201, returns `TeamOut`), `GET /teams` (200, returns `list[TeamOut]`)

- [ ] **Step 1: Write `app/db.py`**

```python
# Author: Bishakh
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

# check_same_thread only matters for SQLite; harmless to compute conditionally.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Write `app/models.py`**

```python
# Author: Bishakh
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    group: Mapped[str] = mapped_column(String(1), nullable=False)
```

- [ ] **Step 3: Write `app/schemas.py`**

```python
# Author: Bishakh
from pydantic import BaseModel, ConfigDict


class TeamCreate(BaseModel):
    name: str
    code: str
    group: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    group: str
```

- [ ] **Step 4: Write the failing test + test fixtures**

`tests/conftest.py`:

```python
# Author: Bishakh
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db

# StaticPool keeps a single shared connection so the in-memory DB (and its
# tables) is visible across threads — TestClient runs endpoints in a worker thread.
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
```

`tests/test_teams.py`:

```python
# Author: Bishakh
def test_create_and_list_team(client):
    payload = {"name": "Argentina", "code": "ARG", "group": "A"}
    create = client.post("/teams", json=payload)
    assert create.status_code == 201
    body = create.json()
    assert body["id"] > 0
    assert body["code"] == "ARG"

    listing = client.get("/teams")
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["name"] == "Argentina"
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pytest tests/test_teams.py -v`
Expected: FAIL — 404 on `POST /teams` (router not mounted yet)

- [ ] **Step 6: Write `app/routers/teams.py`**

`app/routers/__init__.py` is a single line `# Author: Bishakh`.

```python
# Author: Bishakh
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import Team
from app.schemas import TeamCreate, TeamOut

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamCreate, db: Session = Depends(get_db)) -> Team:
    team = Team(name=payload.name, code=payload.code, group=payload.group)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db)) -> list[Team]:
    return list(db.scalars(select(Team)).all())
```

- [ ] **Step 7: Mount router + create tables on startup in `app/main.py`**

Replace `app/main.py` with:

```python
# Author: Bishakh
from fastapi import FastAPI
from app.db import Base, engine
from app.routers import teams

app = FastAPI(title="World Cup Hub — Core API")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(teams.router)
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pytest -v`
Expected: PASS (both `test_health` and `test_teams`)

- [ ] **Step 9: Commit**

```bash
git add worldcup-hub/services/core-api
git commit -m "feat(core-api): add db layer, Team model, and teams endpoints"
```

---

### Task 3: `Fixture` model + fixtures endpoints

**Files:**
- Modify: `worldcup-hub/services/core-api/app/models.py`
- Modify: `worldcup-hub/services/core-api/app/schemas.py`
- Create: `worldcup-hub/services/core-api/app/routers/fixtures.py`
- Modify: `worldcup-hub/services/core-api/app/main.py`
- Test: `worldcup-hub/services/core-api/tests/test_fixtures.py`

**Interfaces:**
- Consumes: `Team` model, `get_db`, `Base` from Task 2.
- Produces:
  - `Fixture` model: `id: int (pk)`, `home_team_id: int (fk teams.id)`, `away_team_id: int (fk teams.id)`, `kickoff: datetime`, `status: str` (default `"scheduled"`)
  - `FixtureCreate {home_team_id, away_team_id, kickoff}` and `FixtureOut {id, home_team_id, away_team_id, kickoff, status}`
  - Endpoints: `POST /fixtures` (201), `GET /fixtures` (200, list)

- [ ] **Step 1: Add `Fixture` to `app/models.py`**

Append:

```python
from datetime import datetime
from sqlalchemy import ForeignKey, DateTime


class Fixture(Base):
    __tablename__ = "fixtures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    home_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    away_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    kickoff: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
```

- [ ] **Step 2: Add schemas to `app/schemas.py`**

Append:

```python
from datetime import datetime


class FixtureCreate(BaseModel):
    home_team_id: int
    away_team_id: int
    kickoff: datetime


class FixtureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    home_team_id: int
    away_team_id: int
    kickoff: datetime
    status: str
```

- [ ] **Step 3: Write the failing test**

`tests/test_fixtures.py`:

```python
# Author: Bishakh
def _make_team(client, name, code, group):
    return client.post("/teams", json={"name": name, "code": code, "group": group}).json()


def test_create_and_list_fixture(client):
    home = _make_team(client, "Brazil", "BRA", "B")
    away = _make_team(client, "France", "FRA", "B")

    payload = {
        "home_team_id": home["id"],
        "away_team_id": away["id"],
        "kickoff": "2026-06-21T18:00:00",
    }
    created = client.post("/fixtures", json=payload)
    assert created.status_code == 201
    assert created.json()["status"] == "scheduled"

    listing = client.get("/fixtures")
    assert listing.status_code == 200
    assert len(listing.json()) == 1
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pytest tests/test_fixtures.py -v`
Expected: FAIL — 404 on `POST /fixtures`

- [ ] **Step 5: Write `app/routers/fixtures.py`**

```python
# Author: Bishakh
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import Fixture
from app.schemas import FixtureCreate, FixtureOut

router = APIRouter(prefix="/fixtures", tags=["fixtures"])


@router.post("", response_model=FixtureOut, status_code=status.HTTP_201_CREATED)
def create_fixture(payload: FixtureCreate, db: Session = Depends(get_db)) -> Fixture:
    fixture = Fixture(
        home_team_id=payload.home_team_id,
        away_team_id=payload.away_team_id,
        kickoff=payload.kickoff,
    )
    db.add(fixture)
    db.commit()
    db.refresh(fixture)
    return fixture


@router.get("", response_model=list[FixtureOut])
def list_fixtures(db: Session = Depends(get_db)) -> list[Fixture]:
    return list(db.scalars(select(Fixture)).all())
```

- [ ] **Step 6: Mount the fixtures router in `app/main.py`**

Add the import and include line:

```python
from app.routers import teams, fixtures
# ... after app.include_router(teams.router):
app.include_router(fixtures.router)
```

- [ ] **Step 7: Run all tests to verify they pass**

Run: `pytest -v`
Expected: PASS (health, teams, fixtures)

- [ ] **Step 8: Commit**

```bash
git add worldcup-hub/services/core-api
git commit -m "feat(core-api): add Fixture model and fixtures endpoints"
```

---

### Task 4: `core-api` Dockerfile (multi-stage)

**Files:**
- Create: `worldcup-hub/services/core-api/Dockerfile`
- Create: `worldcup-hub/services/core-api/.dockerignore`

**Interfaces:**
- Produces: an image that runs `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

- [ ] **Step 1: Write `.dockerignore`**

```
# Author: Bishakh
__pycache__/
*.pyc
.venv/
dev.db
tests/
```

- [ ] **Step 2: Write `Dockerfile` (multi-stage)**

```dockerfile
# Author: Bishakh
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Build the image to verify it works**

Run (from `worldcup-hub/services/core-api/`): `docker build -t worldcup-core-api .`
Expected: build completes; final line `naming to docker.io/library/worldcup-core-api`

- [ ] **Step 4: Commit**

```bash
git add worldcup-hub/services/core-api/Dockerfile worldcup-hub/services/core-api/.dockerignore
git commit -m "build(core-api): add multi-stage Dockerfile"
```

---

### Task 5: `simulator` — ports/adapters + event engine

**Files:**
- Create: `worldcup-hub/services/simulator/app/__init__.py`
- Create: `worldcup-hub/services/simulator/app/ports.py`
- Create: `worldcup-hub/services/simulator/app/adapters/__init__.py`
- Create: `worldcup-hub/services/simulator/app/adapters/simulated.py`
- Create: `worldcup-hub/services/simulator/app/adapters/real_api.py`
- Create: `worldcup-hub/services/simulator/requirements.txt`
- Create: `worldcup-hub/services/simulator/pytest.ini`
- Create: `worldcup-hub/services/simulator/tests/__init__.py`
- Test: `worldcup-hub/services/simulator/tests/test_simulated_source.py`

**Interfaces:**
- Produces:
  - `MatchEvent` dataclass: `minute: int`, `type: str` (one of `"goal" | "card" | "kickoff" | "commentary"`), `team_code: str | None`, `text: str`
  - `MatchEventSource` Protocol with `def events(self, fixture_id: int) -> Iterator[MatchEvent]`
  - `SimulatedSource(seed: int)` implementing the port — deterministic for a given seed, always yields a `kickoff` event first at minute 0 and at least one `goal` over a 90-minute match.
  - `RealApiSource` stub implementing the port, raising `NotImplementedError` from `events()`.

- [ ] **Step 1: Write `requirements.txt` and `pytest.ini`**

`requirements.txt`:

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
pytest==8.3.4
httpx==0.28.1
```

`pytest.ini`:

```ini
# Author: Bishakh
[pytest]
pythonpath = .
testpaths = tests
```

`app/__init__.py`, `app/adapters/__init__.py`, `tests/__init__.py` each contain `# Author: Bishakh`.

- [ ] **Step 2: Write `app/ports.py`**

```python
# Author: Bishakh
from dataclasses import dataclass
from typing import Iterator, Optional, Protocol


@dataclass
class MatchEvent:
    minute: int
    type: str
    team_code: Optional[str]
    text: str


class MatchEventSource(Protocol):
    def events(self, fixture_id: int) -> Iterator[MatchEvent]:
        ...
```

- [ ] **Step 3: Write the failing test**

`tests/test_simulated_source.py`:

```python
# Author: Bishakh
from app.adapters.simulated import SimulatedSource
from app.ports import MatchEvent


def test_first_event_is_kickoff():
    source = SimulatedSource(seed=42)
    events = list(source.events(fixture_id=1))
    assert events[0].type == "kickoff"
    assert events[0].minute == 0


def test_match_has_at_least_one_goal():
    source = SimulatedSource(seed=42)
    events = list(source.events(fixture_id=1))
    assert any(e.type == "goal" for e in events)


def test_deterministic_for_same_seed():
    a = list(SimulatedSource(seed=7).events(1))
    b = list(SimulatedSource(seed=7).events(1))
    assert [(e.minute, e.type, e.text) for e in a] == [(e.minute, e.type, e.text) for e in b]
```

- [ ] **Step 4: Run test to verify it fails**

Run (from `worldcup-hub/services/simulator/`): `pytest tests/test_simulated_source.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.adapters.simulated'`

- [ ] **Step 5: Write `app/adapters/simulated.py`**

```python
# Author: Bishakh
import random
from typing import Iterator
from app.ports import MatchEvent

TEAM_CODES = ["HOME", "AWAY"]


class SimulatedSource:
    """Deterministic match-event generator for a given seed."""

    def __init__(self, seed: int) -> None:
        self._seed = seed

    def events(self, fixture_id: int) -> Iterator[MatchEvent]:
        rng = random.Random(self._seed + fixture_id)
        yield MatchEvent(minute=0, type="kickoff", team_code=None, text="Kick-off!")

        # Guarantee at least one goal so downstream demos always have action.
        goal_minute = rng.randint(1, 89)
        scored = False
        for minute in range(1, 91):
            if minute == goal_minute or (not scored and minute == 90):
                team = rng.choice(TEAM_CODES)
                scored = True
                yield MatchEvent(minute=minute, type="goal", team_code=team,
                                 text=f"GOAL for {team}!")
            elif rng.random() < 0.05:
                team = rng.choice(TEAM_CODES)
                yield MatchEvent(minute=minute, type="card", team_code=team,
                                 text=f"Yellow card for {team}.")
            elif rng.random() < 0.1:
                yield MatchEvent(minute=minute, type="commentary", team_code=None,
                                 text=f"Minute {minute}: end-to-end stuff.")
```

- [ ] **Step 6: Write `app/adapters/real_api.py` (stub)**

```python
# Author: Bishakh
from typing import Iterator
from app.ports import MatchEvent


class RealApiSource:
    """Adapter for a real football feed. Wired in a later phase."""

    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url
        self._api_key = api_key

    def events(self, fixture_id: int) -> Iterator[MatchEvent]:
        raise NotImplementedError("RealApiSource is wired in a later phase.")
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pytest -v`
Expected: PASS (all three tests)

- [ ] **Step 8: Commit**

```bash
git add worldcup-hub/services/simulator
git commit -m "feat(simulator): add ports/adapters and deterministic event engine"
```

---

### Task 6: `simulator` FastAPI streaming endpoint

**Files:**
- Create: `worldcup-hub/services/simulator/app/main.py`
- Test: `worldcup-hub/services/simulator/tests/test_api.py`

**Interfaces:**
- Consumes: `SimulatedSource`, `MatchEvent` from Task 5.
- Produces:
  - `GET /health` → `{"status": "ok"}`
  - `GET /matches/{fixture_id}/events?seed=42` → `200`, JSON `{"fixture_id": int, "events": [ {minute, type, team_code, text}, ... ]}` (full match list; the streaming/SSE transport comes in Phase 2 — this endpoint returns the materialized list so it is trivially testable now).

- [ ] **Step 1: Write the failing test**

`tests/test_api.py`:

```python
# Author: Bishakh
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_events_endpoint_returns_kickoff_first():
    resp = client.get("/matches/1/events", params={"seed": 42})
    assert resp.status_code == 200
    body = resp.json()
    assert body["fixture_id"] == 1
    assert body["events"][0]["type"] == "kickoff"
    assert any(e["type"] == "goal" for e in body["events"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Write `app/main.py`**

```python
# Author: Bishakh
from dataclasses import asdict
from fastapi import FastAPI
from app.adapters.simulated import SimulatedSource

app = FastAPI(title="World Cup Hub — Match Simulator")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/matches/{fixture_id}/events")
def match_events(fixture_id: int, seed: int = 42) -> dict:
    source = SimulatedSource(seed=seed)
    events = [asdict(e) for e in source.events(fixture_id)]
    return {"fixture_id": fixture_id, "events": events}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worldcup-hub/services/simulator
git commit -m "feat(simulator): add health and match-events endpoints"
```

---

### Task 7: `simulator` Dockerfile

**Files:**
- Create: `worldcup-hub/services/simulator/Dockerfile`
- Create: `worldcup-hub/services/simulator/.dockerignore`

**Interfaces:**
- Produces: an image running `uvicorn app.main:app --host 0.0.0.0 --port 9000`.

- [ ] **Step 1: Write `.dockerignore`**

```
# Author: Bishakh
__pycache__/
*.pyc
.venv/
tests/
```

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
# Author: Bishakh
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app ./app
EXPOSE 9000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
```

- [ ] **Step 3: Build the image to verify it works**

Run (from `worldcup-hub/services/simulator/`): `docker build -t worldcup-simulator .`
Expected: build completes successfully.

- [ ] **Step 4: Commit**

```bash
git add worldcup-hub/services/simulator/Dockerfile worldcup-hub/services/simulator/.dockerignore
git commit -m "build(simulator): add multi-stage Dockerfile"
```

---

### Task 8: Docker Compose — Postgres + core-api + simulator + smoke test

**Files:**
- Create: `worldcup-hub/infra/docker/docker-compose.yml`
- Create: `worldcup-hub/infra/docker/smoke_test.sh`

**Interfaces:**
- Consumes: images built in Tasks 4 and 7 (built from context, not pre-built tags).
- Produces: a running stack where `core-api` is on `localhost:8000`, `simulator` on `localhost:9000`, Postgres on an internal network with a named volume.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
# Author: Bishakh
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: worldcup
      POSTGRES_PASSWORD: worldcup
      POSTGRES_DB: worldcup
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U worldcup"]
      interval: 5s
      timeout: 3s
      retries: 5

  core-api:
    build: ../../services/core-api
    environment:
      DATABASE_URL: postgresql+psycopg://worldcup:worldcup@postgres:5432/worldcup
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy

  simulator:
    build: ../../services/simulator
    ports:
      - "9000:9000"

volumes:
  pgdata:
```

- [ ] **Step 2: Write `smoke_test.sh`**

```bash
#!/usr/bin/env bash
# Author: Bishakh
set -euo pipefail

echo "Waiting for core-api..."
for i in {1..30}; do
  if curl -sf http://localhost:8000/health > /dev/null; then break; fi
  sleep 2
done

curl -sf http://localhost:8000/health | grep -q '"status":"ok"'
curl -sf http://localhost:9000/health | grep -q '"status":"ok"'

# Create a team and read it back
curl -sf -X POST http://localhost:8000/teams \
  -H 'Content-Type: application/json' \
  -d '{"name":"Argentina","code":"ARG","group":"A"}' | grep -q '"code":"ARG"'

curl -sf http://localhost:8000/teams | grep -q 'Argentina'

# Simulator returns a kickoff event
curl -sf "http://localhost:9000/matches/1/events?seed=42" | grep -q '"kickoff"'

echo "SMOKE TEST PASSED"
```

- [ ] **Step 3: Bring the stack up**

Run (from `worldcup-hub/infra/docker/`): `docker compose up -d --build`
Expected: three containers reach running state; `docker compose ps` shows `postgres` healthy.

- [ ] **Step 4: Run the smoke test**

Run: `bash smoke_test.sh`
Expected: final line `SMOKE TEST PASSED`

- [ ] **Step 5: Tear down**

Run: `docker compose down`
Expected: containers removed (volume `pgdata` persists).

- [ ] **Step 6: Commit**

```bash
git add worldcup-hub/infra/docker
git commit -m "build(infra): add docker-compose stack and smoke test for Phase 0"
```

---

## Phase 0 Definition of Done

- `pytest` passes in both `services/core-api` and `services/simulator`.
- `docker compose up -d --build` brings up Postgres + core-api + simulator.
- `smoke_test.sh` prints `SMOKE TEST PASSED`.
- All eight tasks committed.

This is the foundation referenced by `tutorials/README.md` Days 1–3. Phase 1 (Turborepo + micro-frontends) gets its own spec → plan cycle.
