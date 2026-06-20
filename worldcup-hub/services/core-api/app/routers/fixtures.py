# Author: Bishakh
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import Fixture
from app.schemas import FixtureCreate, FixtureOut

router = APIRouter(prefix="/fixtures", tags=["fixtures"])


@router.post("", response_model=FixtureOut, status_code=status.HTTP_201_CREATED)
def create_fixture(payload: FixtureCreate, db: Session = Depends(get_db)) -> Fixture:
    fixture = Fixture(
        home_team_id=payload.home_team_id,
        away_team_id=payload.away_team_id,
        kickoff=payload.kickoff,
    )
    db.add(fixture)
    db.commit()
    db.refresh(fixture)
    return fixture


@router.get("", response_model=list[FixtureOut])
def list_fixtures(db: Session = Depends(get_db)) -> list[Fixture]:
    return list(db.scalars(select(Fixture)).all())
