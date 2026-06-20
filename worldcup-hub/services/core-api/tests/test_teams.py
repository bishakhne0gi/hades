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
