# Author: Bishakh
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# check_same_thread only matters for SQLite; harmless to compute conditionally.
connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Session:
    """FastAPI dependency: yield a request-scoped session, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
