# Author: Bishakh
# Publishes live match state to Redis for the BFF/UI to consume. Two modes,
# chosen by DATA_SOURCE: "sim" (deterministic simulator) or "real" (football-data.org).
# Both publish the SAME self-describing payload, so nothing downstream changes.
import asyncio
import json

import redis.asyncio as redis

from app.adapters.real_api import RealApiSource
from app.adapters.simulated import SimulatedSource
from app.adapters.thesportsdb import TheSportsDbSource
from app.config import (
    DATA_SOURCE,
    DEMO_FIXTURES,
    EVENT_INTERVAL,
    FOOTBALL_API_BASE,
    FOOTBALL_API_KEY,
    FOOTBALL_COMPETITION,
    LOOP_PAUSE,
    POLL_INTERVAL,
    REDIS_URL,
    THESPORTSDB_BASE,
    THESPORTSDB_KEY,
    THESPORTSDB_LEAGUE,
)

CHANNEL = "match.events"


async def _publish(client: "redis.Redis", payload: dict) -> None:
    await client.publish(CHANNEL, json.dumps(payload))


# ── Simulator mode ──────────────────────────────────────────────────────────
async def _play_fixture(client: "redis.Redis", fixture: dict) -> None:
    while True:
        source = SimulatedSource(seed=fixture["seed"])
        home_score = away_score = 0
        for event in source.events(fixture["id"]):
            if event.type == "goal":
                if event.team_code == "HOME":
                    home_score += 1
                elif event.team_code == "AWAY":
                    away_score += 1
            await _publish(
                client,
                {
                    "fixture_id": fixture["id"],
                    "home": fixture["home"],
                    "away": fixture["away"],
                    "group": fixture["group"],
                    "home_score": home_score,
                    "away_score": away_score,
                    "minute": event.minute,
                    "status": "live",
                    "type": event.type,
                    "team_code": event.team_code,
                    "text": event.text,
                },
            )
            await asyncio.sleep(EVENT_INTERVAL)
        await asyncio.sleep(LOOP_PAUSE)


async def _run_sim(client: "redis.Redis") -> None:
    print(f"[simulator] sim mode: publishing {len(DEMO_FIXTURES)} fixtures to '{CHANNEL}'", flush=True)
    await asyncio.gather(*[_play_fixture(client, f) for f in DEMO_FIXTURES])


# ── Real feed mode (any adapter with fetch_live_states) ─────────────────────
async def _run_real(client: "redis.Redis", source, label: str) -> None:
    print(f"[simulator] {label} mode: polling every {POLL_INTERVAL}s", flush=True)
    while True:
        try:
            states = await source.fetch_live_states()
            print(f"[simulator] {label}: published {len(states)} match states", flush=True)
            for s in states:
                await _publish(client, {**s, "type": "commentary", "team_code": None})
        except Exception as exc:  # noqa: BLE001 — keep polling on transient errors
            print(f"[simulator] {label} error: {exc}", flush=True)
        await asyncio.sleep(POLL_INTERVAL)


async def run_publishers() -> None:
    client = redis.from_url(REDIS_URL)
    try:
        await client.ping()
    except Exception as exc:  # noqa: BLE001
        print(f"[simulator] Redis unavailable ({exc}); realtime publishing disabled")
        return

    if DATA_SOURCE == "thesportsdb":
        source = TheSportsDbSource(THESPORTSDB_KEY, THESPORTSDB_LEAGUE, THESPORTSDB_BASE)
        await _run_real(client, source, "thesportsdb")
    elif DATA_SOURCE == "real":
        source = RealApiSource(FOOTBALL_API_BASE, FOOTBALL_API_KEY, FOOTBALL_COMPETITION)
        await _run_real(client, source, "football-data")
    else:
        await _run_sim(client)
