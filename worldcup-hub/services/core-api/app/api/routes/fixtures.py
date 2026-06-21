# Author: Bishakh
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.repositories.fixture_repository import FixtureRepository
from app.services.fixture_service import FixtureService, SameTeamError
from app.schemas.fixture import FixtureCreate, FixtureOut

router = APIRouter(prefix="/fixtures", tags=["fixtures"])


def get_fixture_service(db: Session = Depends(get_db)) -> FixtureService:
    """Wire the dependency chain: session -> repository -> service."""
    return FixtureService(FixtureRepository(db))


@router.post("", response_model=FixtureOut, status_code=status.HTTP_201_CREATED)
def create_fixture(
    payload: FixtureCreate, service: FixtureService = Depends(get_fixture_service)
) -> FixtureOut:
    try:
        return service.create_fixture(payload)
    except SameTeamError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="home and away teams must differ",
        )


@router.get("", response_model=list[FixtureOut])
def list_fixtures(
    service: FixtureService = Depends(get_fixture_service),
) -> list[FixtureOut]:
    return service.list_fixtures()
