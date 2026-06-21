// Author: Bishakh
// Subscribes to the match feed (sim OR real — same payload) and keeps live state
// entirely from the messages, so the BFF doesn't care which source produced them.
import { EventEmitter } from "node:events";
import { createClient } from "redis";
import type { MatchEvent, ScoreboardMatch, StandingRow } from "@wc/types";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const CHANNEL = "match.events";

interface LiveState {
  home: string;
  away: string;
  group: string;
  home_score: number;
  away_score: number;
  minute: number;
  status: string;
}

interface IncomingEvent extends LiveState {
  fixture_id: number;
  type: MatchEvent["type"];
  team_code: string | null;
  text: string;
}

const live = new Map<number, LiveState>();
const commentary = new Map<number, MatchEvent[]>();
const lastSeen = new Map<number, number>();
// Only show fixtures whose source is still publishing — so when you switch data
// sources (or a match's source goes quiet), stale fixtures drop off automatically.
const FRESH_MS = 90_000;

function freshFixtures(): Array<[number, LiveState]> {
  const cutoff = Date.now() - FRESH_MS;
  return [...live.entries()].filter(([id]) => (lastSeen.get(id) ?? 0) >= cutoff);
}

/** Bus events: "scoreboard" (any change) and `match:<id>` (one commentary line). */
export const bus = new EventEmitter();
bus.setMaxListeners(0);

export function scoreboardSnapshot(): ScoreboardMatch[] {
  return freshFixtures()
    .sort(([a], [b]) => a - b)
    .map(([fixture_id, s]) => ({
      fixture_id,
      home: s.home,
      away: s.away,
      home_score: s.home_score,
      away_score: s.away_score,
      minute: s.minute,
      status: s.status,
    }));
}

export function computeStandings(): StandingRow[] {
  const table = new Map<string, StandingRow>();
  const ensure = (team: string, group: string): StandingRow => {
    let row = table.get(team);
    if (!row) {
      row = { team, group, played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
      table.set(team, row);
    }
    return row;
  };
  for (const [, s] of freshFixtures()) {
    const h = ensure(s.home, s.group);
    const a = ensure(s.away, s.group);
    h.played += 1;
    a.played += 1;
    if (s.home_score > s.away_score) {
      h.won += 1; h.points += 3; a.lost += 1;
    } else if (s.home_score < s.away_score) {
      a.won += 1; a.points += 3; h.lost += 1;
    } else {
      h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1;
    }
  }
  return [...table.values()].sort((x, y) => y.points - x.points || x.group.localeCompare(y.group));
}

export function matchView(fixtureId: number): { fixture: { id: number; home: string; away: string; group: string }; events: MatchEvent[] } | null {
  const s = live.get(fixtureId);
  if (!s) return null;
  return {
    fixture: { id: fixtureId, home: s.home, away: s.away, group: s.group },
    events: commentary.get(fixtureId) ?? [],
  };
}

export function recentCommentary(fixtureId: number): MatchEvent[] {
  return commentary.get(fixtureId) ?? [];
}

function applyEvent(ev: IncomingEvent): void {
  if (ev.type === "kickoff") commentary.set(ev.fixture_id, []);
  lastSeen.set(ev.fixture_id, Date.now());
  live.set(ev.fixture_id, {
    home: ev.home,
    away: ev.away,
    group: ev.group ?? "-",
    home_score: ev.home_score,
    away_score: ev.away_score,
    minute: ev.minute,
    status: ev.status,
  });

  const line: MatchEvent = { minute: ev.minute, type: ev.type, team_code: ev.team_code, text: ev.text };
  const buf = commentary.get(ev.fixture_id) ?? [];
  buf.push(line);
  if (buf.length > 80) buf.shift();
  commentary.set(ev.fixture_id, buf);

  bus.emit("scoreboard");
  bus.emit(`match:${ev.fixture_id}`, line);
}

/** Best-effort: if Redis is down the polling endpoints still work, just not live. */
export async function startRedisSubscriber(): Promise<void> {
  const client = createClient({ url: REDIS_URL });
  client.on("error", (e) => console.error("[bff] redis error:", (e as Error).message));
  try {
    await client.connect();
    await client.subscribe(CHANNEL, (message) => {
      try {
        applyEvent(JSON.parse(message) as IncomingEvent);
      } catch {
        /* ignore malformed */
      }
    });
    console.log(`[bff] subscribed to '${CHANNEL}' on ${REDIS_URL}`);
  } catch (e) {
    console.error(`[bff] could not connect to Redis (${(e as Error).message}); realtime disabled`);
  }
}
