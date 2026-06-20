# Author: Bishakh
from fastapi import FastAPI
from app.db import Base, engine
from app.routers import teams, fixtures

app = FastAPI(title="World Cup Hub — Core API")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(teams.router)
app.include_router(fixtures.router)
