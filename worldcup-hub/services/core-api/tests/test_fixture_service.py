# Author: Bishakh
"""Unit tests for FixtureService using a fake repository."""
from datetime import datetime
import pytest
from app.services.fixture_service import FixtureService, SameTeamError
from app.schemas.fixture import FixtureCreate


class FakeFixtureRepository:
    def __init__(self) -> None:
        self._fixtures: list = []
        self._next_id = 0

    def add(self, fixture):
        self._next_id += 1
        fixture.id = self._next_id
        self._fixtures.append(fixture)
        return fixture

    def list(self):
        return list(self._fixtures)


def test_create_fixture_assigns_id():
    service = FixtureService(FakeFixtureRepository())
    fixture = service.create_fixture(
        FixtureCreate(home_team_id=1, away_team_id=2, kickoff=datetime(2026, 6, 21, 18, 0))
    )
    assert fixture.id == 1
    assert fixture.home_team_id == 1
    assert fixture.away_team_id == 2


def test_create_fixture_rejects_same_team():
    service = FixtureService(FakeFixtureRepository())
    with pytest.raises(SameTeamError):
        service.create_fixture(
            FixtureCreate(home_team_id=1, away_team_id=1, kickoff=datetime(2026, 6, 21, 18, 0))
        )
