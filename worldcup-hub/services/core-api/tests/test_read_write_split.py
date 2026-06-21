# Author: Bishakh
# Proves the read/write split is real: writes hit the PRIMARY dependency, reads
# hit the REPLICA dependency. We bind them to two SEPARATE in-memory databases,
# so a team written to the primary is NOT visible via the (empty) replica.
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.db.base import Base
from app.db.session import get_db, get_read_db


def _make_engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    return eng, sessionmaker(bind=eng, autoflush=False, autocommit=False)


def test_writes_go_to_primary_reads_to_replica():
    primary_engine, PrimarySession = _make_engine()
    replica_engine, ReplicaSession = _make_engine()  # deliberately separate + empty

    def override_primary():
        db = PrimarySession()
        try:
            yield db
        finally:
            db.close()

    def override_replica():
        db = ReplicaSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_primary
    app.dependency_overrides[get_read_db] = override_replica
    try:
        client = TestClient(app)
        # Write goes to the primary.
        created = client.post("/teams", json={"name": "Argentina", "code": "ARG", "group": "A"})
        assert created.status_code == 201

        # Read comes from the (separate, empty) replica → does NOT see the write.
        listing = client.get("/teams")
        assert listing.status_code == 200
        assert listing.json() == []
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=primary_engine)
        Base.metadata.drop_all(bind=replica_engine)
