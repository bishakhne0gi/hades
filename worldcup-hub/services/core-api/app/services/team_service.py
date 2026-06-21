# Author: Bishakh
from app.models.team import Team
from app.repositories.team_repository import TeamRepository
from app.schemas.team import TeamCreate


class DuplicateTeamCodeError(Exception):
    """Raised when a team is created with an already-used code."""


class TeamService:
    """Business rules for teams. Depends on a repository interface, not a DB,
    so it can be unit-tested with a fake repository.
    """

    def __init__(self, repo: TeamRepository) -> None:
        self._repo = repo

    def create_team(self, payload: TeamCreate) -> Team:
        if self._repo.get_by_code(payload.code) is not None:
            raise DuplicateTeamCodeError(payload.code)
        team = Team(name=payload.name, code=payload.code, group=payload.group)
        return self._repo.add(team)

    def list_teams(self) -> list[Team]:
        return self._repo.list()
