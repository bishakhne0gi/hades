# Author: Bishakh
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TeamCreate(BaseModel):
    name: str
    code: str
    group: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    group: str


class FixtureCreate(BaseModel):
    home_team_id: int
    away_team_id: int
    kickoff: datetime


class FixtureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    home_team_id: int
    away_team_id: int
    kickoff: datetime
    status: str
