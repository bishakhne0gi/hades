# Author: Bishakh
# Real football feed adapter (football-data.org). Same role as SimulatedSource,
# different source — the ports/adapters boundary means the rest of the app is
# unchanged whether data is simulated or real.
from typing import Any
import httpx


class RealApiSource:
    """Fetches live match state from football-data.org and normalises it into the
    same self-describing shape the simulator publishes."""

    def __init__(self, base_url: str, api_key: str, competition: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._competition = competition

    @staticmethod
    def _team_code(team: dict[str, Any]) -> str:
        return team.get("tla") or team.get("shortName") or team.get("name") or "???"

    @staticmethod
    def _status(api_status: str) -> str:
        if api_status in ("IN_PLAY", "PAUSED"):
            return "live"
        if api_status == "FINISHED":
            return "finished"
        return "scheduled"

    async def fetch_live_states(self) -> list[dict[str, Any]]:
        """Return normalised match states. Prefers live matches; if none are live
        it returns a few upcoming/recent matches so the UI still shows real teams."""
        if not self._api_key:
            raise RuntimeError("FOOTBALL_API_KEY is not set")

        url = f"{self._base_url}/competitions/{self._competition}/matches"
        headers = {"X-Auth-Token": self._api_key}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            matches = resp.json().get("matches", [])

        normalised = [self._normalise(m) for m in matches]
        live = [m for m in normalised if m["status"] == "live"]
        if live:
            return live
        # Fallback: show up to 6 scheduled/finished matches so the UI isn't empty.
        return normalised[:6]

    @staticmethod
    def _group(m: dict[str, Any]) -> str:
        # World Cup: group like "GROUP_A" → "A"; knockout stage → short stage tag.
        g = m.get("group")
        if g:
            return g.replace("GROUP_", "")
        stage = (m.get("stage") or "").replace("_", " ").title()
        return stage[:10] or "-"

    def _normalise(self, m: dict[str, Any]) -> dict[str, Any]:
        home_team = m.get("homeTeam", {}) or {}
        away_team = m.get("awayTeam", {}) or {}
        home = self._team_code(home_team)
        away = self._team_code(away_team)
        full = (m.get("score", {}) or {}).get("fullTime", {}) or {}
        hs = full.get("home") or 0
        aw = full.get("away") or 0
        status = self._status(m.get("status", ""))
        minute = m.get("minute") or 0
        return {
            "fixture_id": m.get("id", 0),
            "home": home,
            "away": away,
            "group": self._group(m),
            "home_score": hs,
            "away_score": aw,
            "minute": minute,
            "status": status,
            "kickoff": m.get("utcDate"),
            "home_crest": home_team.get("crest") or "",
            "away_crest": away_team.get("crest") or "",
            "text": f"{home} {hs}-{aw} {away} ({m.get('status', '')})",
        }
