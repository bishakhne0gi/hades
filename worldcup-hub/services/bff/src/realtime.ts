// Author: Bishakh
// Subscribes to the simulator's Redis fan-out, keeps live in-memory state, and
// emits events the WebSocket (scoreboard) and SSE (commentary) routes listen to.
import { EventEmitter } from "node:events";
import { createClient } from "redis";
import type { MatchEvent, ScoreboardMatch } from "@wc/types";
import { DEMO_FIXTURES } from "./upstream.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const CHANNEL = "match.events";

interface LiveState {
  home: number;
  away: number;
  minute: number;
  status: string;
}

interface IncomingEvent {
  fixture_id: number;
  minute: number;
  type: MatchEvent["type"];
  team_code: string | null;
  text: string;
}

const live = new Map<number, LiveState>();
const commentary = new Map<number, MatchEvent[]>();

/** Bus events: "scoreboard" (any score change) and `match:<id>` (one commentary line). */
export const bus = new EventEmitter();
bus.setMaxListeners(0);

export function scoreboardSnapshot(): ScoreboardMatch[] {
  return DEMO_FIXTURES.map((f) => {
    const s = live.get(f.id) ?? { home: 0, away: 0, minute: 0, status: "scheduled" };
    return {
      fixture_id: f.id,
      home: f.home,
      away: f.away,
      home_score: s.home,
      away_score: s.away,
      minute: s.minute,
      status: s.status,
    };
  });
}

export function recentCommentary(fixtureId: number): MatchEvent[] {
  return commentary.get(fixtureId) ?? [];
}

function applyEvent(ev: IncomingEvent): void {
  let s = live.get(ev.fixture_id);
  if (!s || ev.type === "kickoff") {
    s = { home: 0, away: 0, minute: 0, status: "live" };
    live.set(ev.fixture_id, s);
    commentary.set(ev.fixture_id, []);
  }
  s.minute = ev.minute;
  if (ev.type === "goal") {
    if (ev.team_code === "HOME") s.home += 1;
    else if (ev.team_code === "AWAY") s.away += 1;
  }

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
