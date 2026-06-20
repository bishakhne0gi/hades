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
