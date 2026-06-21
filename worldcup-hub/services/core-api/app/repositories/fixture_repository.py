# Author: Bishakh
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.fixture import Fixture


class FixtureRepository:
    """All Fixture database access lives here."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def add(self, fixture: Fixture) -> Fixture:
        self._db.add(fixture)
        self._db.commit()
        self._db.refresh(fixture)
        return fixture

    def list(self) -> list[Fixture]:
        return list(self._db.scalars(select(Fixture)).all())
