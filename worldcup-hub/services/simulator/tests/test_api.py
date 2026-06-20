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
