// Author: Bishakh
// Thin clients for the upstream services the BFF aggregates.
import type { MatchEvent } from "@wc/types";

export const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:8000";
export const SIMULATOR_URL = process.env.SIMULATOR_URL ?? "http://localhost:9000";

/** A fixture the BFF knows how to render. Demo data keeps the UI alive even
 *  before core-api is seeded; in production this list comes from core-api. */
export interface DemoFixture {
  id: number;
  home: string; // team code
  away: string; // team code
  group: string;
  seed: number;
}

export const DEMO_FIXTURES: DemoFixture[] = [
  { id: 1, home: "ARG", away: "BRA", group: "A", seed: 42 },
  { id: 2, home: "FRA", away: "ESP", group: "A", seed: 7 },
  { id: 3, home: "ENG", away: "GER", group: "B", seed: 13 },
  { id: 4, home: "POR", away: "NED", group: "B", seed: 99 },
];

/** Fetch the full simulated event list for a fixture. Falls back to [] if the
 *  simulator is unreachable, so the BFF degrades gracefully. */
export async function fetchEvents(fixtureId: number, seed: number): Promise<MatchEvent[]> {
  try {
    const res = await fetch(`${SIMULATOR_URL}/matches/${fixtureId}/events?seed=${seed}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { events: MatchEvent[] };
    return body.events ?? [];
  } catch {
    return [];
  }
}

/** Count goals per side from an event list. team_code is "HOME"/"AWAY". */
export function tallyGoals(events: MatchEvent[]): { home: number; away: number; lastMinute: number } {
  let home = 0;
  let away = 0;
  let lastMinute = 0;
  for (const e of events) {
    lastMinute = Math.max(lastMinute, e.minute);
    if (e.type === "goal") {
      if (e.team_code === "HOME") home += 1;
      else if (e.team_code === "AWAY") away += 1;
    }
  }
  return { home, away, lastMinute };
}
