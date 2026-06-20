# Author: Bishakh
import random
from typing import Iterator
from app.ports import MatchEvent

TEAM_CODES = ["HOME", "AWAY"]


class SimulatedSource:
    """Deterministic match-event generator for a given seed."""

    def __init__(self, seed: int) -> None:
        self._seed = seed

    def events(self, fixture_id: int) -> Iterator[MatchEvent]:
        rng = random.Random(self._seed + fixture_id)
        yield MatchEvent(minute=0, type="kickoff", team_code=None, text="Kick-off!")

        # Guarantee at least one goal so downstream demos always have action.
        goal_minute = rng.randint(1, 89)
        scored = False
        for minute in range(1, 91):
            if minute == goal_minute or (not scored and minute == 90):
                team = rng.choice(TEAM_CODES)
                scored = True
                yield MatchEvent(minute=minute, type="goal", team_code=team,
                                 text=f"GOAL for {team}!")
            elif rng.random() < 0.05:
                team = rng.choice(TEAM_CODES)
                yield MatchEvent(minute=minute, type="card", team_code=team,
                                 text=f"Yellow card for {team}.")
            elif rng.random() < 0.1:
                yield MatchEvent(minute=minute, type="commentary", team_code=None,
                                 text=f"Minute {minute}: end-to-end stuff.")
