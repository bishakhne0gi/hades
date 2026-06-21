// Author: Bishakh
// Real FIFA World Cup data from football-data.org (v4), mapped to the shared
// view-model contract (@wc/types). All upstream reads go through a small
// in-memory cache with a TTL to respect the free tier's ~10 req/min limit;
// on upstream error we serve the last good (stale) value and never throw to a
// route. The /competitions/WC/matches call is the workhorse — it returns
// fixtures + live state + scores for all 104 matches in one request.

import type {
  FixtureView,
  MatchDetail,
  MatchEvent,
  MatchStatus,
  Referee,
  ScoreLine,
  StandingRow,
} from "@wc/types";
import { enrichMatchDetail } from "./apiFootball.js";
import { espnMatchExtras } from "./espn.js";

const API_BASE = process.env.FOOTBALL_API_BASE ?? "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_API_KEY ?? "";
const COMPETITION = process.env.FOOTBALL_COMPETITION ?? "WC";

/** True when a real API key is configured — the route layer uses this to decide. */
export const realDataEnabled = (): boolean => API_KEY.length > 0;

// ── Upstream shapes (only the fields we consume) ─────────────────────────────

interface ApiTeam {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}
interface ApiScoreLine {
  home: number | null;
  away: number | null;
}
interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  stage: string;
  group?: string | null;
  matchday?: number | null;
  venue?: string | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score?: {
    duration?: string;
    fullTime?: ApiScoreLine;
    halfTime?: ApiScoreLine;
    extraTime?: ApiScoreLine;
    penalties?: ApiScoreLine;
  };
  referees?: Array<{ name?: string; type?: string; nationality?: string }>;
  odds?: { homeWin?: number; draw?: number; awayWin?: number };
}
interface ApiMatchesResponse {
  matches?: ApiMatch[];
}
interface ApiStandingsResponse {
  standings?: Array<{
    group?: string | null;
    type?: string;
    table?: Array<{
      position: number;
      team: ApiTeam;
      playedGames: number;
      form?: string | null;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    }>;
  }>;
}

// ── Cached fetcher ───────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T | null;
  ts: number; // ms epoch when `value` was fetched
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Fetch `path` (relative to API_BASE) as JSON, cached under `key` for `ttlMs`.
 * Serves the cached value while fresh; on upstream failure serves the last good
 * value (stale) instead of throwing. Returns null only when there is no value
 * and the request fails.
 */
async function cachedGet<T>(key: string, path: string, ttlMs: number): Promise<T | null> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry && entry.value !== null && now - entry.ts < ttlMs) {
    return entry.value;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "X-Auth-Token": API_KEY },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const value = (await res.json()) as T;
    cache.set(key, { value, ts: now });
    return value;
  } catch (err) {
    console.error(`[bff] football-data fetch failed (${path}): ${(err as Error).message}`);
    // Serve stale on error if we have anything cached.
    return entry?.value ?? null;
  }
}

function getAllMatches(): Promise<ApiMatchesResponse | null> {
  return cachedGet<ApiMatchesResponse>(
    "matches",
    `/competitions/${COMPETITION}/matches`,
    15_000,
  );
}
function getStandings(): Promise<ApiStandingsResponse | null> {
  return cachedGet<ApiStandingsResponse>(
    "standings",
    `/competitions/${COMPETITION}/standings`,
    60_000,
  );
}
function getMatchById(id: number): Promise<ApiMatch | null> {
  return cachedGet<ApiMatch>(`match:${id}`, `/matches/${id}`, 30_000);
}

// ── Mappers ──────────────────────────────────────────────────────────────────

/** football-data status → our MatchStatus. */
function mapStatus(status: string): MatchStatus {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    case "FINISHED":
      return "finished";
    default:
      return "scheduled";
  }
}

/** "GROUP_A" → "A"; null / knockout → "". */
function mapGroup(group?: string | null): string {
  if (!group) return "";
  const m = /^GROUP_([A-Z])$/.exec(group);
  return m?.[1] ?? "";
}

function teamCode(t: ApiTeam): string {
  return t.tla ?? t.shortName ?? t.name ?? "TBD";
}

function mapFixture(m: ApiMatch): FixtureView {
  const status = mapStatus(m.status);
  const ft = m.score?.fullTime;
  return {
    id: m.id,
    home: teamCode(m.homeTeam),
    away: teamCode(m.awayTeam),
    home_name: m.homeTeam.name ?? "TBD",
    away_name: m.awayTeam.name ?? "TBD",
    home_crest: m.homeTeam.crest ?? undefined,
    away_crest: m.awayTeam.crest ?? undefined,
    home_score: ft?.home ?? null,
    away_score: ft?.away ?? null,
    status,
    minute: status === "live" ? m.minute ?? null : null,
    kickoff: m.utcDate,
    group: mapGroup(m.group),
    stage: m.stage,
    matchday: m.matchday ?? undefined,
    venue: m.venue ?? undefined,
  };
}

function mapScoreLine(s?: ApiScoreLine): ScoreLine | undefined {
  if (!s) return undefined;
  if (s.home === null && s.away === null) return undefined;
  return { home: s.home, away: s.away };
}

// ── Public view functions (return the contract shapes) ───────────────────────

/** ALL matches (~104) mapped to FixtureView, sorted by kickoff. */
export async function fixturesView(): Promise<FixtureView[]> {
  const data = await getAllMatches();
  const matches = data?.matches ?? [];
  return matches
    .map(mapFixture)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/**
 * Scoreboard view — same data as fixtures, but live matches first, then by
 * kickoff. The frontend can still filter/sort further.
 */
export async function scoreboardView(): Promise<FixtureView[]> {
  const fixtures = await fixturesView();
  const rank = (s: MatchStatus) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
  return [...fixtures].sort(
    (a, b) => rank(a.status) - rank(b.status) || a.kickoff.localeCompare(b.kickoff),
  );
}

/** Flatten the 12 group tables (TOTAL only) into enriched StandingRow[]. */
export async function standingsView(): Promise<StandingRow[]> {
  const data = await getStandings();
  const rows: StandingRow[] = [];
  for (const s of data?.standings ?? []) {
    // Some feeds also include HOME/AWAY split tables; only keep the TOTAL one.
    if (s.type && s.type !== "TOTAL") continue;
    const group = mapGroupName(s.group);
    for (const r of s.table ?? []) {
      rows.push({
        team: teamCode(r.team),
        team_name: r.team.name ?? undefined,
        crest: r.team.crest ?? undefined,
        group,
        position: r.position,
        played: r.playedGames,
        won: r.won,
        drawn: r.draw,
        lost: r.lost,
        goals_for: r.goalsFor,
        goals_against: r.goalsAgainst,
        goal_difference: r.goalDifference,
        points: r.points,
        form: r.form ?? undefined,
      });
    }
  }
  return rows;
}

/** Standings groups come as "Group A" (not "GROUP_A") → "A". */
function mapGroupName(group?: string | null): string {
  if (!group) return "";
  const m = /([A-Z])$/.exec(group.trim());
  return m?.[1] ?? "";
}

/** Full match detail for one match, or null if not found. */
export async function matchDetailView(id: number): Promise<MatchDetail | null> {
  const m = await getMatchById(id);
  if (!m || !m.id) return null;
  const referees: Referee[] = (m.referees ?? [])
    .filter((r) => r.name)
    .map((r) => ({
      name: r.name as string,
      role: r.type ?? undefined,
      nationality: r.nationality ?? undefined,
    }));
  const odds =
    m.odds && (m.odds.homeWin != null || m.odds.draw != null || m.odds.awayWin != null)
      ? { home_win: m.odds.homeWin, draw: m.odds.draw, away_win: m.odds.awayWin }
      : undefined;
  const fixture = mapFixture(m);
  const detail: MatchDetail = {
    fixture,
    score: {
      halftime: mapScoreLine(m.score?.halfTime),
      fulltime: mapScoreLine(m.score?.fullTime),
      extratime: mapScoreLine(m.score?.extraTime),
      penalties: mapScoreLine(m.score?.penalties),
    },
    venue: m.venue ?? undefined,
    referees,
    odds,
    events: [], // football-data free tier exposes no play-by-play
    detail_source: "none",
  };

  // Enrich with REAL lineups / formations / events / statistics for played
  // matches. ESPN first (keyless), then API-Football (when an APIFOOTBALL_KEY
  // is set) as a fallback.
  let extras = await espnMatchExtras({
    id: fixture.id,
    home: fixture.home,
    away: fixture.away,
    home_name: fixture.home_name,
    away_name: fixture.away_name,
    kickoff: fixture.kickoff,
  });
  let source: MatchDetail["detail_source"] = "espn";
  if (!extras) {
    extras = await enrichMatchDetail(fixture.home_name, fixture.away_name, fixture.kickoff);
    source = "api-football";
  }
  if (extras) {
    if (extras.events.length) detail.events = extras.events;
    detail.lineups = extras.lineups;
    detail.statistics = extras.statistics;
    detail.detail_source = source;
  }
  return detail;
}
