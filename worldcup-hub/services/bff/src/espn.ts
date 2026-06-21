// Author: Bishakh
// Free live commentary + key events from ESPN's public site API (no key needed).
// football-data.org's free tier gives scores/standings/fixtures but NO play-by-play;
// ESPN's hidden site API exposes a rich `commentary` feed (minute + text) plus
// `keyEvents` (goals, cards) for the same World Cup matches. We resolve a
// football-data fixture to its ESPN event (by date + team match), then map the
// summary into our shared MatchEvent[] contract so the existing SSE pipeline can
// stream it. All reads are cached (ESPN is generous but we stay polite).

import type { LineupPlayer, MatchEvent, MatchStatistic, TeamLineup } from "@wc/types";
import type { MatchEnrichment } from "./apiFootball.js";

const ESPN_BASE =
  process.env.ESPN_BASE ?? "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_LEAGUE = process.env.ESPN_LEAGUE ?? "fifa.world";

/** A football-data fixture, reduced to what we need to find the ESPN event. */
export interface FixtureLite {
  id: number;
  home: string;
  away: string;
  home_name: string;
  away_name: string;
  kickoff: string; // ISO
}

// ── tiny cache ───────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T | null;
  ts: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function cachedGetJson<T>(key: string, url: string, ttlMs: number): Promise<T | null> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry && entry.value !== null && now - entry.ts < ttlMs) return entry.value;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = (await res.json()) as T;
    cache.set(key, { value, ts: now });
    return value;
  } catch (err) {
    console.error(`[bff] espn fetch failed (${url}): ${(err as Error).message}`);
    return entry?.value ?? null;
  }
}

// ── upstream shapes (only what we read) ──────────────────────────────────────

interface EspnTeam {
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  location?: string;
}
interface EspnCompetitor {
  homeAway: string;
  team: EspnTeam;
}
interface EspnEvent {
  id: string;
  date: string;
  competitions: Array<{ competitors: EspnCompetitor[] }>;
}
interface EspnScoreboard {
  events?: EspnEvent[];
}
interface EspnCommentaryItem {
  sequence?: number;
  time?: { displayValue?: string };
  text?: string;
}
interface EspnPlayer {
  starter?: boolean;
  jersey?: string | null;
  athlete?: { displayName?: string; jersey?: string | null };
  position?: { abbreviation?: string };
  formationPlace?: string | null;
}
interface EspnSummary {
  commentary?: EspnCommentaryItem[];
  rosters?: Array<{ team: { displayName?: string }; formation?: string; roster?: EspnPlayer[] }>;
  boxscore?: {
    teams?: Array<{
      team: { displayName?: string };
      statistics?: Array<{ name: string; label?: string; displayValue: string }>;
    }>;
  };
  keyEvents?: Array<{
    type?: { text?: string; type?: string };
    text?: string;
    scoringPlay?: boolean;
    clock?: { displayValue?: string };
  }>;
  header?: {
    competitions?: Array<{
      status?: { displayClock?: string; type?: { state?: string; completed?: boolean } };
    }>;
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Normalise a team string for fuzzy matching across providers. */
function norm(s?: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

/** ISO kickoff → ESPN `dates=YYYYMMDD` (UTC). */
function yyyymmdd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

function teamMatches(c: EspnCompetitor, code: string, name: string): boolean {
  const cands = [c.team.abbreviation, c.team.displayName, c.team.shortDisplayName, c.team.name, c.team.location].map(norm);
  const wantCode = norm(code);
  const wantName = norm(name);
  return cands.some((x) => x !== "" && (x === wantCode || x === wantName || x.includes(wantName) || (wantName !== "" && wantName.includes(x))));
}

/** Parse "45'+2'" / "10'" → 45 / 10. */
function parseMinute(display?: string): number {
  if (!display) return 0;
  const m = /(\d+)/.exec(display);
  return m ? Number(m[1]) : 0;
}

function classify(text: string): MatchEvent["type"] {
  const t = text.toLowerCase();
  if (t.startsWith("goal")) return "goal";
  if (t.includes("yellow card") || t.includes("red card") || t.includes("second yellow") || t.includes("is shown the")) return "card";
  if (t.includes("first half begins") || t.includes("kick-off") || t.includes("kickoff")) return "kickoff";
  return "commentary";
}

// ── resolution + feed ────────────────────────────────────────────────────────

/** Resolve a football-data fixture to its ESPN event id (cached). */
async function resolveEventId(fx: FixtureLite): Promise<string | null> {
  const cacheKey = `resolve:${fx.id}`;
  const hit = cache.get(cacheKey) as CacheEntry<string> | undefined;
  // Successful resolutions are stable; cache long. Misses retry after 60s.
  if (hit && hit.value) return hit.value;
  if (hit && hit.value === null && Date.now() - hit.ts < 60_000) return null;

  // Providers disagree on exact dates, so search the WHOLE tournament window and
  // match by team PAIR (a single scoreboard call returns all ~104 matches). We
  // prefer an exact-date hit, else fall back to any date with that pairing.
  const year = new Date(fx.kickoff).getUTCFullYear() || new Date().getUTCFullYear();
  const range = `${year}0601-${year}0731`; // FIFA World Cup runs Jun–Jul
  const day = yyyymmdd(fx.kickoff);
  const sb = await cachedGetJson<EspnScoreboard>(
    `sb:${range}`,
    `${ESPN_BASE}/${ESPN_LEAGUE}/scoreboard?dates=${range}`,
    6 * 60 * 60 * 1000,
  );
  let found: string | null = null;
  for (const ev of sb?.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const matchesPair =
      comp.competitors.some((c) => teamMatches(c, fx.home, fx.home_name)) &&
      comp.competitors.some((c) => teamMatches(c, fx.away, fx.away_name));
    if (!matchesPair) continue;
    found = ev.id;
    if (yyyymmdd(ev.date) === day) break; // exact-date match wins
  }
  cache.set(cacheKey, { value: found, ts: Date.now() });
  return found;
}

export interface EspnFeed {
  events: MatchEvent[];
  /** Live match minute parsed from ESPN's clock, if available. */
  minute: number | null;
}

/**
 * Full commentary feed (oldest → newest) + live minute for a fixture.
 * Returns an empty feed (events: []) when no ESPN match is found or it errors —
 * the caller treats that as "no commentary available".
 */
export async function espnMatchFeed(fx: FixtureLite): Promise<EspnFeed> {
  const eid = await resolveEventId(fx);
  if (!eid) return { events: [], minute: null };

  const summary = await cachedGetJson<EspnSummary>(
    `sum:${eid}`,
    `${ESPN_BASE}/${ESPN_LEAGUE}/summary?event=${eid}`,
    15_000,
  );
  if (!summary) return { events: [], minute: null };

  const items = [...(summary.commentary ?? [])].sort(
    (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0),
  );
  const events: MatchEvent[] = items
    .filter((it) => (it.text ?? "").trim().length > 0)
    .map((it) => {
      const text = (it.text ?? "").trim();
      return {
        minute: parseMinute(it.time?.displayValue),
        type: classify(text),
        team_code: null,
        text,
      };
    });

  const clock = summary.header?.competitions?.[0]?.status?.displayClock;
  const minute = clock ? parseMinute(clock) : null;

  return { events, minute };
}

// ── rich detail: lineups (formation) + statistics (possession, ...) ──────────

function mapEspnPlayer(p: EspnPlayer): LineupPlayer {
  const num = p.jersey ?? p.athlete?.jersey ?? undefined;
  return {
    name: p.athlete?.displayName ?? "—",
    number: num != null && num !== "" ? Number(num) : undefined,
    pos: p.position?.abbreviation,
    grid: p.formationPlace ?? undefined,
  };
}

function mapKeyEvent(e: NonNullable<EspnSummary["keyEvents"]>[number]): MatchEvent {
  const t = (e.type?.type ?? "").toLowerCase();
  const type: MatchEvent["type"] =
    e.scoringPlay || t.includes("goal")
      ? "goal"
      : t.includes("card")
        ? "card"
        : t.includes("kickoff")
          ? "kickoff"
          : "commentary";
  return { minute: parseMinute(e.clock?.displayValue), type, team_code: null, text: e.text ?? e.type?.text ?? "" };
}

/**
 * Full rich detail for a fixture: lineups + formation, team statistics
 * (possession, shots, cards, corners, ...) and key events. Returns null when no
 * ESPN match resolves. NO API key required.
 */
export async function espnMatchExtras(fx: FixtureLite): Promise<MatchEnrichment | null> {
  const eid = await resolveEventId(fx);
  if (!eid) return null;
  const summary = await cachedGetJson<EspnSummary>(
    `sum:${eid}`,
    `${ESPN_BASE}/${ESPN_LEAGUE}/summary?event=${eid}`,
    15_000,
  );
  if (!summary) return null;

  // lineups → home/away by team-name match
  const lineups: MatchEnrichment["lineups"] = {};
  for (const r of summary.rosters ?? []) {
    const all = r.roster ?? [];
    const team: TeamLineup = {
      team: r.team.displayName ?? "—",
      formation: r.formation,
      startXI: all.filter((p) => p.starter).map(mapEspnPlayer),
      subs: all.filter((p) => !p.starter).map(mapEspnPlayer),
    };
    if (teamMatches({ homeAway: "home", team: { displayName: r.team.displayName } }, fx.home, fx.home_name)) {
      lineups.home = team;
    } else if (teamMatches({ homeAway: "away", team: { displayName: r.team.displayName } }, fx.away, fx.away_name)) {
      lineups.away = team;
    } else if (!lineups.home) {
      lineups.home = team;
    } else {
      lineups.away = team;
    }
  }

  // statistics → merge the two teams' blocks by label
  const blocks = summary.boxscore?.teams ?? [];
  const isHome = (b: (typeof blocks)[number]) =>
    teamMatches({ homeAway: "home", team: { displayName: b.team.displayName } }, fx.home, fx.home_name);
  const homeBlock = blocks.find(isHome) ?? blocks[0];
  const awayBlock = blocks.find((b) => b !== homeBlock) ?? blocks[1];
  const labels: string[] = (homeBlock?.statistics ?? []).map((s) => s.label ?? s.name);
  const valueOf = (b: (typeof blocks)[number] | undefined, label: string) =>
    b?.statistics?.find((s) => (s.label ?? s.name) === label)?.displayValue ?? null;
  const statistics: MatchStatistic[] = labels.map((label) => ({
    type: label,
    home: valueOf(homeBlock, label),
    away: valueOf(awayBlock, label),
  }));

  const events = (summary.keyEvents ?? []).map(mapKeyEvent);

  return { events, lineups, statistics };
}
