# Author: Bishakh
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.team import Team


class TeamRepository:
    """All Team database access lives here — the only layer that knows SQL.

    Swapping the storage engine (or routing reads to a replica in Phase 4)
    means changing this class only; services and routers stay untouched.
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    def add(self, team: Team) -> Team:
        self._db.add(team)
        self._db.commit()
        self._db.refresh(team)
        return team

    def list(self) -> list[Team]:
        return list(self._db.scalars(select(Team)).all())

    def get_by_code(self, code: str) -> Optional[Team]:
        return self._db.scalars(select(Team).where(Team.code == code)).first()
