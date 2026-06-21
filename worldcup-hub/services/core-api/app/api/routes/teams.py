# Author: Bishakh
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db, get_read_db
from app.repositories.team_repository import TeamRepository
from app.services.team_service import TeamService, DuplicateTeamCodeError
from app.schemas.team import TeamCreate, TeamOut

router = APIRouter(prefix="/teams", tags=["teams"])


def get_team_service(db: Session = Depends(get_db)) -> TeamService:
    """Write path: primary session -> repository -> service."""
    return TeamService(TeamRepository(db))


def get_team_read_service(db: Session = Depends(get_read_db)) -> TeamService:
    """Read path: replica session -> repository -> service."""
    return TeamService(TeamRepository(db))


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate, service: TeamService = Depends(get_team_service)
) -> TeamOut:
    try:
        return service.create_team(payload)
    except DuplicateTeamCodeError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Team code already exists"
        )


@router.get("", response_model=list[TeamOut])
def list_teams(service: TeamService = Depends(get_team_read_service)) -> list[TeamOut]:
    return service.list_teams()
