# Author: Bishakh
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings


def _connect_args(url: str) -> dict:
    # check_same_thread only matters for SQLite.
    return {"check_same_thread": False} if url.startswith("sqlite") else {}


# Primary engine — all writes go here.
engine = create_engine(settings.database_url, connect_args=_connect_args(settings.database_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Read-replica engine — read-only queries, to scale reads off the primary.
read_engine = create_engine(
    settings.read_database_url, connect_args=_connect_args(settings.read_database_url)
)
ReadSessionLocal = sessionmaker(bind=read_engine, autoflush=False, autocommit=False)


def get_db() -> Session:
    """FastAPI dependency: primary session for writes. Always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_read_db() -> Session:
    """FastAPI dependency: replica session for reads (falls back to primary)."""
    db = ReadSessionLocal()
    try:
        yield db
    finally:
        db.close()
