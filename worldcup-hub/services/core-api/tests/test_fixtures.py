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
