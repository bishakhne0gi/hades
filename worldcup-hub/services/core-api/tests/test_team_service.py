# Author: Bishakh
"""Unit tests for TeamService using a FAKE repository — no database needed.

This is the payoff of the layered design: business rules are tested in
microseconds without spinning up SQLite or HTTP.
"""
import pytest
from app.services.team_service import TeamService, DuplicateTeamCodeError
from app.schemas.team import TeamCreate


class FakeTeamRepository:
    def __init__(self) -> None:
        self._teams: list = []
        self._next_id = 0

    def get_by_code(self, code: str):
        return next((t for t in self._teams if t.code == code), None)

    def add(self, team):
        self._next_id += 1
        team.id = self._next_id
        self._teams.append(team)
        return team

    def list(self):
        return list(self._teams)


def test_create_team_assigns_id_and_persists():
    service = TeamService(FakeTeamRepository())
    team = service.create_team(TeamCreate(name="Argentina", code="ARG", group="A"))
    assert team.id == 1
    assert team.code == "ARG"
    assert len(service.list_teams()) == 1


def test_create_team_rejects_duplicate_code():
    service = TeamService(FakeTeamRepository())
    service.create_team(TeamCreate(name="Argentina", code="ARG", group="A"))
    with pytest.raises(DuplicateTeamCodeError):
        service.create_team(TeamCreate(name="Argentina B", code="ARG", group="A"))
