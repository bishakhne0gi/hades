# Author: Bishakh
"""Integration test for TeamRepository against a real (in-memory) database."""
from app.repositories.team_repository import TeamRepository
from app.models.team import Team


def test_add_and_get_by_code(db_session):
    repo = TeamRepository(db_session)
    repo.add(Team(name="Brazil", code="BRA", group="B"))

    found = repo.get_by_code("BRA")
    assert found is not None
    assert found.name == "Brazil"
    assert found.id > 0


def test_get_by_code_returns_none_when_missing(db_session):
    repo = TeamRepository(db_session)
    assert repo.get_by_code("ZZZ") is None


def test_list_returns_all_added(db_session):
    repo = TeamRepository(db_session)
    repo.add(Team(name="Brazil", code="BRA", group="B"))
    repo.add(Team(name="France", code="FRA", group="B"))
    assert len(repo.list()) == 2
