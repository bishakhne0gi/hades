# Author: Bishakh
from app.adapters.simulated import SimulatedSource
from app.ports import MatchEvent


def test_first_event_is_kickoff():
    source = SimulatedSource(seed=42)
    events = list(source.events(fixture_id=1))
    assert events[0].type == "kickoff"
    assert events[0].minute == 0


def test_match_has_at_least_one_goal():
    source = SimulatedSource(seed=42)
    events = list(source.events(fixture_id=1))
    assert any(e.type == "goal" for e in events)


def test_deterministic_for_same_seed():
    a = list(SimulatedSource(seed=7).events(1))
    b = list(SimulatedSource(seed=7).events(1))
    assert [(e.minute, e.type, e.text) for e in a] == [(e.minute, e.type, e.text) for e in b]
