# Author: Bishakh
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# "sim"         → deterministic match simulator (default, always on, no keys).
# "thesportsdb" → REAL match data, NO key required (free test key, recent results).
# "real"        → football-data.org live matches (needs a free FOOTBALL_API_KEY).
DATA_SOURCE = os.getenv("DATA_SOURCE", "sim").lower()

# ── Simulator (sim mode) ────────────────────────────────────────────────────
# Each fixture carries its team codes so every published event is self-describing.
DEMO_FIXTURES = [
    {"id": 1, "home": "ARG", "away": "BRA", "group": "A", "seed": 42},
    {"id": 2, "home": "FRA", "away": "ESP", "group": "A", "seed": 7},
    {"id": 3, "home": "ENG", "away": "GER", "group": "B", "seed": 13},
    {"id": 4, "home": "POR", "away": "NED", "group": "B", "seed": 99},
]
EVENT_INTERVAL = float(os.getenv("EVENT_INTERVAL", "0.5"))
LOOP_PAUSE = float(os.getenv("LOOP_PAUSE", "4"))

# ── Real feed (real mode) ───────────────────────────────────────────────────
# Get a free token at https://www.football-data.org/client/register
FOOTBALL_API_BASE = os.getenv("FOOTBALL_API_BASE", "https://api.football-data.org/v4")
FOOTBALL_API_KEY = os.getenv("FOOTBALL_API_KEY", "")
# Competition code: WC (World Cup), CL (Champions League), PL (Premier League)...
FOOTBALL_COMPETITION = os.getenv("FOOTBALL_COMPETITION", "WC")
# Seconds between polls — keep ≥ 10s to respect the free tier (10 req/min).
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "20"))

# ── TheSportsDB (real data, no key needed) ──────────────────────────────────
THESPORTSDB_BASE = os.getenv("THESPORTSDB_BASE", "https://www.thesportsdb.com/api/v1/json")
THESPORTSDB_KEY = os.getenv("THESPORTSDB_KEY", "123")  # free public test key
# League id: 4328 = English Premier League. (FIFA World Cup populates during the tournament.)
THESPORTSDB_LEAGUE = os.getenv("THESPORTSDB_LEAGUE", "4328")
