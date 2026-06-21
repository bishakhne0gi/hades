# Author: Bishakh
from pydantic import BaseModel, ConfigDict


class TeamCreate(BaseModel):
    """Input DTO — what a client sends to create a team."""

    name: str
    code: str
    group: str


class TeamOut(BaseModel):
    """Output DTO — what the API returns. Reads straight off the ORM object."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    group: str
