# Author: Bishakh
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FixtureCreate(BaseModel):
    """Input DTO — what a client sends to schedule a fixture."""

    home_team_id: int
    away_team_id: int
    kickoff: datetime


class FixtureOut(BaseModel):
    """Output DTO — what the API returns for a fixture."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    home_team_id: int
    away_team_id: int
    kickoff: datetime
    status: str
