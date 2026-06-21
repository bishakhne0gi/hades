# Author: Bishakh
# Continuously "plays" the demo fixtures and publishes each match event to Redis,
# so the BFF (and through it the UI) gets a live, never-ending feed. This is the
# fan-out source for WebSocket / SSE / polling in the frontend.
import asyncio
import json
from dataclasses import asdict

import redis.asyncio as redis

from app.adapters.simulated import SimulatedSource
from app.config import DEMO_FIXTURES, EVENT_INTERVAL, LOOP_PAUSE, REDIS_URL

CHANNEL = "match.events"


async def _play_fixture(client: "redis.Redis", fixture: dict) -> None:
    source = SimulatedSource(seed=fixture["seed"])
    while True:
        # Each loop re-emits a kickoff first; the BFF treats that as a score reset.
        for event in source.events(fixture["id"]):
            payload = {"fixture_id": fixture["id"], **asdict(event)}
            await client.publish(CHANNEL, json.dumps(payload))
            await asyncio.sleep(EVENT_INTERVAL)
        await asyncio.sleep(LOOP_PAUSE)


async def run_publishers() -> None:
    client = redis.from_url(REDIS_URL)
    try:
        await client.ping()
    except Exception as exc:  # noqa: BLE001 — degrade gracefully if Redis is absent
        print(f"[simulator] Redis unavailable ({exc}); realtime publishing disabled")
        return
    print(f"[simulator] publishing live events to {REDIS_URL} on channel '{CHANNEL}'")
    await asyncio.gather(*[_play_fixture(client, f) for f in DEMO_FIXTURES])
