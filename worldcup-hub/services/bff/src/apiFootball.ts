// Author: Bishakh
// Rich match detail from API-Football (api-sports.io) — the free tier (100
// req/day) exposes what football-data.org does not: LINEUPS + FORMATIONS,
// EVENTS (goals/cards/subs) and STATISTICS (possession, shots, ...). It only has
// this for matches that have been PLAYED, so we enrich finished/past fixtures.
//
// football-data and API-Football use different fixture ids, so we resolve the
// API-Football fixture by team names + kickoff date within a configured
// competition/season (default: World Cup 2022, the last completed tournament).
import type { LineupPlayer, MatchEvent, MatchStatistic, TeamLineup } from "@wc/types";

const KEY = process.env.APIFOOTBALL_KEY ?? "";
const BASE = process.env.APIFOOTBALL_BASE ?? "https://v3.football.api-sports.io";
const LEAGUE = process.env.APIFOOTBALL_LEAGUE ?? "1"; // 1 = FIFA World Cup
const SEASON = process.env.APIFOOTBALL_SEASON ?? "2022"; // last completed WC

export const apiFootballEnabled = (): boolean => KEY.length > 0;

export interface MatchEnrichment {
  events: MatchEvent[];
  lineups: { home?: TeamLineup; away?: TeamLineup };
  statistics: MatchStatistic[];
}

// ── tiny cached GET (free tier is 100 req/day → cache hard) ──────────────────
interface CacheEntry<T> {
  value: T | null;
  ts: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function get<T>(key: string, path: string, ttlMs: number): Promise<T | null> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (hit && hit.value !== null && now - hit.ts < ttlMs) return hit.value;
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = (await res.json()) as T;
    cache.set(key, { value, ts: now });
    return value;
  } catch (err) {
    console.error(`[bff] api-football fetch failed (${path}): ${(err as Error).message}`);
    return hit?.value ?? null;
  }
}

// ── team-name matching across providers ──────────────────────────────────────
const ALIASES: Record<string, string> = {
  korearepublic: "southkorea",
  republicofkorea: "southkorea",
  iriran: "iran",
  unitedstates: "usa",
  us: "usa",
  czechia: "czechrepublic",
  turkiye: "turkey",
};
function norm(s: string): string {
  const n = (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  return ALIASES[n] ?? n;
}

// ── API-Football response shapes (only fields we use) ────────────────────────
interface AfFixtureItem {
  fixture: { id: number; date: string };
  teams: { home: { name: string }; away: { name: string } };
}
interface AfLineup {
  team: { name: string };
  formation: string | null;
  coach?: { name?: string | null } | null;
  startXI: Array<{ player: { name: string; number?: number; pos?: string; grid?: string | null } }>;
  substitutes: Array<{ player: { name: string; number?: number; pos?: string; grid?: string | null } }>;
}
interface AfEvent {
  time: { elapsed: number | null; extra?: number | null };
  team: { name: string };
  player?: { name?: string | null };
  assist?: { name?: string | null };
  type: string; // "Goal" | "Card" | "subst" | "Var"
  detail: string;
}
interface AfStatBlock {
  team: { name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

/** Resolve the API-Football fixture id for a match by team names (+ date). */
async function resolveFixtureId(home: string, away: string, kickoffIso: string): Promise<number | null> {
  const data = await get<{ response?: AfFixtureItem[] }>(
    `fixtures:${LEAGUE}:${SEASON}`,
    `/fixtures?league=${LEAGUE}&season=${SEASON}`,
    6 * 60 * 60 * 1000, // 6h
  );
  const items = data?.response ?? [];
  const day = kickoffIso.slice(0, 10);
  const wantH = norm(home);
  const wantW = norm(away);
  // Prefer an exact team+day match; fall back to team-pair only.
  let fallback: number | null = null;
  for (const it of items) {
    const h = norm(it.teams.home.name);
    const a = norm(it.teams.away.name);
    const pair = (h === wantH && a === wantW) || (h === wantW && a === wantH);
    if (!pair) continue;
    fallback = it.fixture.id;
    if (it.fixture.date.slice(0, 10) === day) return it.fixture.id;
  }
  return fallback;
}

function mapLineup(l: AfLineup): TeamLineup {
  const player = (p: AfLineup["startXI"][number]): LineupPlayer => ({
    name: p.player.name,
    number: p.player.number,
    pos: p.player.pos,
    grid: p.player.grid ?? undefined,
  });
  return {
    team: l.team.name,
    formation: l.formation ?? undefined,
    coach: l.coach?.name ?? undefined,
    startXI: (l.startXI ?? []).map(player),
    subs: (l.substitutes ?? []).map(player),
  };
}

function mapEvent(e: AfEvent): MatchEvent {
  const minute = (e.time.elapsed ?? 0) + (e.time.extra ?? 0);
  const type: MatchEvent["type"] =
    e.type === "Goal" ? "goal" : e.type === "Card" ? "card" : "commentary";
  const who = e.player?.name ? ` ${e.player.name}` : "";
  const assist = e.assist?.name ? ` (assist ${e.assist.name})` : "";
  const text = `${e.detail}${who} — ${e.team.name}${type === "goal" ? assist : ""}`;
  return { minute, type, team_code: null, text };
}

/** Fetch lineups + events + statistics for a resolved fixture id. */
async function enrichByFixtureId(
  fixtureId: number,
  homeName: string,
  awayName: string,
): Promise<MatchEnrichment> {
  const [lineupsRes, eventsRes, statsRes] = await Promise.all([
    get<{ response?: AfLineup[] }>(`lineups:${fixtureId}`, `/fixtures/lineups?fixture=${fixtureId}`, 12 * 60 * 60 * 1000),
    get<{ response?: AfEvent[] }>(`events:${fixtureId}`, `/fixtures/events?fixture=${fixtureId}`, 12 * 60 * 60 * 1000),
    get<{ response?: AfStatBlock[] }>(`stats:${fixtureId}`, `/fixtures/statistics?fixture=${fixtureId}`, 12 * 60 * 60 * 1000),
  ]);

  // lineups → home/away by team-name match
  const lineups: MatchEnrichment["lineups"] = {};
  for (const l of lineupsRes?.response ?? []) {
    const mapped = mapLineup(l);
    if (norm(l.team.name) === norm(homeName)) lineups.home = mapped;
    else if (norm(l.team.name) === norm(awayName)) lineups.away = mapped;
    else if (!lineups.home) lineups.home = mapped;
    else lineups.away = mapped;
  }

  // events (sorted by minute)
  const events = (eventsRes?.response ?? []).map(mapEvent).sort((a, b) => a.minute - b.minute);

  // statistics → merge the two teams' blocks by stat type
  const blocks = statsRes?.response ?? [];
  const homeBlock = blocks.find((b) => norm(b.team.name) === norm(homeName)) ?? blocks[0];
  const awayBlock = blocks.find((b) => norm(b.team.name) === norm(awayName)) ?? blocks[1];
  const types = new Set<string>();
  for (const b of blocks) for (const s of b.statistics ?? []) types.add(s.type);
  const valueOf = (b: AfStatBlock | undefined, type: string) =>
    b?.statistics.find((s) => s.type === type)?.value ?? null;
  const statistics: MatchStatistic[] = [...types].map((type) => ({
    type,
    home: valueOf(homeBlock, type),
    away: valueOf(awayBlock, type),
  }));

  return { events, lineups, statistics };
}

/** Public: enrich a match by team names + kickoff. null when no key / no match. */
export async function enrichMatchDetail(
  homeName: string,
  awayName: string,
  kickoffIso: string,
): Promise<MatchEnrichment | null> {
  if (!apiFootballEnabled()) return null;
  try {
    const fixtureId = await resolveFixtureId(homeName, awayName, kickoffIso);
    if (!fixtureId) return null;
    return await enrichByFixtureId(fixtureId, homeName, awayName);
  } catch (err) {
    console.error(`[bff] api-football enrich failed: ${(err as Error).message}`);
    return null;
  }
}
