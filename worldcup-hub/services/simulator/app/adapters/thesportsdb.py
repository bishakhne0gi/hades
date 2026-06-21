# Author: Bishakh
# TheSportsDB adapter — REAL match data with NO API key required (free test key).
# Returns recent real results for a league (real teams + real scores). Same
# fetch_live_states() shape as the other adapters, so nothing downstream changes.
from typing import Any
import httpx


def _to_int(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


class TheSportsDbSource:
    def __init__(self, key: str, league_id: str, base_url: str) -> None:
        self._key = key
        self._league_id = league_id
        self._base_url = base_url.rstrip("/")

    async def _get_events(self, client: "httpx.AsyncClient", endpoint: str) -> list[dict[str, Any]]:
        url = f"{self._base_url}/{self._key}/{endpoint}.php?id={self._league_id}"
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json().get("events") or []
        except Exception:  # noqa: BLE001 — one endpoint failing shouldn't kill the feed
            return []

    async def fetch_live_states(self) -> list[dict[str, Any]]:
        # Combine recent RESULTS (with scores) and UPCOMING fixtures (real teams),
        # so the board has matches even out of season.
        async with httpx.AsyncClient(timeout=15) as client:
            past = await self._get_events(client, "eventspastleague")
            upcoming = await self._get_events(client, "eventsnextleague")

        seen: set[int] = set()
        states: list[dict[str, Any]] = []
        for e in [*past, *upcoming]:
            fid = _to_int(e.get("idEvent"))
            if not fid or fid in seen:
                continue
            seen.add(fid)
            home = e.get("strHomeTeam") or "Home"
            away = e.get("strAwayTeam") or "Away"
            has_score = e.get("intHomeScore") not in (None, "") and e.get("intAwayScore") not in (None, "")
            hs = _to_int(e.get("intHomeScore"))
            aw = _to_int(e.get("intAwayScore"))
            league = e.get("strLeague") or "-"
            status = "finished" if has_score else "scheduled"
            states.append(
                {
                    "fixture_id": fid,
                    "home": home,
                    "away": away,
                    "group": league[:14],
                    "home_score": hs,
                    "away_score": aw,
                    "minute": 0,
                    "status": status,
                    "text": (f"FT: {home} {hs}-{aw} {away}" if has_score else f"Upcoming: {home} vs {away}"),
                }
            )
            if len(states) >= 8:
                break
        return states
