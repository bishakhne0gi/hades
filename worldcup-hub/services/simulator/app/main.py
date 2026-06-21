# Author: Bishakh
import asyncio
from dataclasses import asdict
from fastapi import FastAPI
from app.adapters.simulated import SimulatedSource
from app.realtime import run_publishers

app = FastAPI(title="World Cup Hub — Match Simulator")


@app.on_event("startup")
async def _start_realtime() -> None:
    # Fire-and-forget the live publisher; it no-ops if Redis is unavailable.
    asyncio.create_task(run_publishers())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/matches/{fixture_id}/events")
def match_events(fixture_id: int, seed: int = 42) -> dict:
    source = SimulatedSource(seed=seed)
    events = [asdict(e) for e in source.events(fixture_id)]
    return {"fixture_id": fixture_id, "events": events}
