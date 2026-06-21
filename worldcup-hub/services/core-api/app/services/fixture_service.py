# Author: Bishakh
from app.models.fixture import Fixture
from app.repositories.fixture_repository import FixtureRepository
from app.schemas.fixture import FixtureCreate


class SameTeamError(Exception):
    """Raised when a fixture has the same team on both sides."""


class FixtureService:
    """Business rules for fixtures."""

    def __init__(self, repo: FixtureRepository) -> None:
        self._repo = repo

    def create_fixture(self, payload: FixtureCreate) -> Fixture:
        if payload.home_team_id == payload.away_team_id:
            raise SameTeamError("home and away teams must differ")
        fixture = Fixture(
            home_team_id=payload.home_team_id,
            away_team_id=payload.away_team_id,
            kickoff=payload.kickoff,
        )
        return self._repo.add(fixture)

    def list_fixtures(self) -> list[Fixture]:
        return self._repo.list()
