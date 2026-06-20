# Author: Bishakh
from typing import Iterator
from app.ports import MatchEvent


class RealApiSource:
    """Adapter for a real football feed. Wired in a later phase."""

    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url
        self._api_key = api_key

    def events(self, fixture_id: int) -> Iterator[MatchEvent]:
        raise NotImplementedError("RealApiSource is wired in a later phase.")
