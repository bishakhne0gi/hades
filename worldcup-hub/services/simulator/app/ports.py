# Author: Bishakh
from dataclasses import dataclass
from typing import Iterator, Optional, Protocol


@dataclass
class MatchEvent:
    minute: int
    type: str
    team_code: Optional[str]
    text: str


class MatchEventSource(Protocol):
    def events(self, fixture_id: int) -> Iterator[MatchEvent]:
        ...
