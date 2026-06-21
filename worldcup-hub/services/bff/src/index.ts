// Author: Bishakh
// Backend-for-Frontend: aggregates core-api + simulator and shapes a tailored
// view-model for each micro-frontend, so the UI never over-fetches or sees raw
// domain shapes. One route per panel.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  NewsItem,
  ScoreboardMatch,
  StandingRow,
  TimestampedEnvelope,
} from "@wc/types";
import { DEMO_FIXTURES, fetchEvents, tallyGoals } from "./upstream.js";

const app = new Hono();
app.use("*", cors());

const now = () => new Date().toISOString();
function envelope<T>(data: T): TimestampedEnvelope<T> {
  return { data, generated_at: now() };
}

app.get("/bff/health", (c) => c.json({ status: "ok" }));

// Scoreboard: one shaped row per fixture (scores derived from simulator events).
app.get("/bff/scoreboard", async (c) => {
  const rows: ScoreboardMatch[] = await Promise.all(
    DEMO_FIXTURES.map(async (f) => {
      const events = await fetchEvents(f.id, f.seed);
      const { home, away, lastMinute } = tallyGoals(events);
      return {
        fixture_id: f.id,
        home: f.home,
        away: f.away,
        home_score: home,
        away_score: away,
        minute: lastMinute,
        status: events.length ? "finished" : "scheduled",
      };
    }),
  );
  return c.json(envelope(rows));
});

// Standings: computed from fixture results, grouped.
app.get("/bff/standings", async (c) => {
  const table = new Map<string, StandingRow>();
  const ensure = (team: string, group: string): StandingRow => {
    let row = table.get(team);
    if (!row) {
      row = { team, group, played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
      table.set(team, row);
    }
    return row;
  };

  for (const f of DEMO_FIXTURES) {
    const { home, away } = tallyGoals(await fetchEvents(f.id, f.seed));
    const h = ensure(f.home, f.group);
    const a = ensure(f.away, f.group);
    h.played += 1;
    a.played += 1;
    if (home > away) {
      h.won += 1; h.points += 3; a.lost += 1;
    } else if (home < away) {
      a.won += 1; a.points += 3; h.lost += 1;
    } else {
      h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1;
    }
  }

  const rows = [...table.values()].sort(
    (x, y) => y.points - x.points || x.group.localeCompare(y.group),
  );
  return c.json(envelope(rows));
});

// Match center: the full event feed plus fixture meta for one match.
app.get("/bff/match/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const fixture = DEMO_FIXTURES.find((f) => f.id === id);
  if (!fixture) return c.json({ error: "fixture not found" }, 404);
  const events = await fetchEvents(fixture.id, fixture.seed);
  return c.json(
    envelope({
      fixture: { id: fixture.id, home: fixture.home, away: fixture.away, group: fixture.group },
      events,
    }),
  );
});

// News: static editorial content (CDN-cacheable in a later phase).
app.get("/bff/news", (c) => {
  const items: NewsItem[] = [
    { id: 1, title: "Group stage heats up", summary: "Four matches, plenty of goals.", published_at: now() },
    { id: 2, title: "Tactical preview", summary: "How the favourites line up tonight.", published_at: now() },
    { id: 3, title: "Player to watch", summary: "The breakout star of the tournament so far.", published_at: now() },
  ];
  return c.json(envelope(items));
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
console.log(`[bff] listening on http://localhost:${port}`);

export { app };
