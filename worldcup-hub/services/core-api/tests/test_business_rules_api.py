# Author: Bishakh
"""End-to-end checks that the new business rules surface as HTTP errors."""


def test_duplicate_team_code_returns_409(client):
    payload = {"name": "Argentina", "code": "ARG", "group": "A"}
    assert client.post("/teams", json=payload).status_code == 201
    second = client.post("/teams", json={"name": "Argentina B", "code": "ARG", "group": "A"})
    assert second.status_code == 409


def test_fixture_with_same_team_returns_422(client):
    team = client.post("/teams", json={"name": "Brazil", "code": "BRA", "group": "B"}).json()
    resp = client.post(
        "/fixtures",
        json={
            "home_team_id": team["id"],
            "away_team_id": team["id"],
            "kickoff": "2026-06-21T18:00:00",
        },
    )
    assert resp.status_code == 422
