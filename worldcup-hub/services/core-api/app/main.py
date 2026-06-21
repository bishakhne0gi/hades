# Author: Bishakh
from fastapi import FastAPI
from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401  (import registers all tables on Base.metadata)
from app.api.routes import teams, fixtures

app = FastAPI(title="World Cup Hub — Core API")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(teams.router)
app.include_router(fixtures.router)
