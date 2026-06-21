// Author: Bishakh
// Backend-for-Frontend: aggregates core-api + simulator and shapes a tailored
// view-model for each micro-frontend, so the UI never over-fetches or sees raw
// domain shapes. One route per panel.
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { WSContext } from "hono/ws";
import type { MatchEvent, NewsItem, TimestampedEnvelope } from "@wc/types";
import {
  bus,
  computeStandings,
  matchView,
  recentCommentary,
  scoreboardSnapshot,
  startRedisSubscriber,
} from "./realtime.js";
import {
  fixturesView,
  matchDetailView,
  realDataEnabled,
  scoreboardView,
  standingsView,
} from "./footballData.js";
import { espnMatchFeed } from "./espn.js";

// When a real football-data.org key is present we serve real WC data; otherwise
// we fall back to the existing Redis/simulator path. DATA_SOURCE=sim forces sim.
const USE_REAL = realDataEnabled() && process.env.DATA_SOURCE !== "sim";

const app = new Hono();
app.use("*", cors());
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const now = () => new Date().toISOString();
function envelope<T>(data: T): TimestampedEnvelope<T> {
  return { data, generated_at: now() };
}

app.get("/bff/health", (c) => c.json({ status: "ok", source: USE_REAL ? "real" : "sim" }));

// Fixtures: ALL matches (~104) — real data only.
app.get("/bff/fixtures", async (c) => c.json(envelope(await fixturesView())));

// Scoreboard: live + recent + upcoming. Real feed when keyed, else sim snapshot.
app.get("/bff/scoreboard", async (c) =>
  c.json(envelope(USE_REAL ? await scoreboardView() : scoreboardSnapshot())),
);

// Standings: real group tables when keyed, else computed from sim match state.
app.get("/bff/standings", async (c) =>
  c.json(envelope(USE_REAL ? await standingsView() : computeStandings())),
);

// Match center: full real match detail when keyed, else sim fixture + commentary.
app.get("/bff/match/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (USE_REAL) {
    const detail = await matchDetailView(id);
    if (!detail) return c.json({ error: "fixture not found" }, 404);
    // Live: prefer ESPN's flowing play-by-play commentary + live clock over the
    // sparser key-events list, so the feed reads like real live commentary.
    if (detail.fixture.status === "live") {
      const fx = detail.fixture;
      const feed = await espnMatchFeed({
        id: fx.id,
        home: fx.home,
        away: fx.away,
        home_name: fx.home_name,
        away_name: fx.away_name,
        kickoff: fx.kickoff,
      });
      if (feed.events.length) detail.events = feed.events;
      if (feed.minute != null) detail.fixture = { ...fx, minute: feed.minute };
    }
    return c.json(envelope(detail));
  }
  const view = matchView(id);
  if (!view) return c.json({ error: "fixture not found" }, 404);
  return c.json(envelope(view));
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

// ── Real-time transports ───────────────────────────────────────────────────

// Scoreboard → WebSocket: push the full snapshot on connect and on every change.
const wsClients = new Set<WSContext>();

function broadcast(msg: string): void {
  for (const ws of wsClients) {
    try {
      ws.send(msg);
    } catch {
      /* drop on send error */
    }
  }
}

if (USE_REAL) {
  // No Redis bus in real mode: re-read the cached feed on a timer and push.
  setInterval(() => {
    if (wsClients.size === 0) return;
    void scoreboardView().then((snap) => broadcast(JSON.stringify({ data: snap })));
  }, 15_000);
} else {
  // Sim mode: push on every bus change.
  bus.on("scoreboard", () => broadcast(JSON.stringify({ data: scoreboardSnapshot() })));
}

app.get(
  "/bff/ws/scoreboard",
  upgradeWebSocket(() => ({
    onOpen: (_evt, ws) => {
      wsClients.add(ws);
      if (USE_REAL) {
        void scoreboardView().then((snap) => {
          try {
            ws.send(JSON.stringify({ data: snap }));
          } catch {
            /* drop */
          }
        });
      } else {
        ws.send(JSON.stringify({ data: scoreboardSnapshot() }));
      }
    },
    onClose: (_evt, ws) => {
      wsClients.delete(ws);
    },
  })),
);

// Match center → SSE live commentary.
//  • Real mode: poll ESPN's free play-by-play feed for this fixture and push
//    each new line (deduped) as it appears — goals, cards, chances, the lot.
//  • Sim mode: replay the buffered commentary, then stream new lines off the bus.
app.get("/bff/sse/match/:id", (c) => {
  const id = Number(c.req.param("id"));
  return streamSSE(c, async (stream) => {
    if (USE_REAL) {
      const detail = await matchDetailView(id);
      const fx = detail?.fixture;
      const sent = new Set<string>();
      const keyOf = (e: MatchEvent) => `${e.minute}|${e.type}|${e.text}`;
      while (!stream.aborted && fx) {
        const feed = await espnMatchFeed({
          id: fx.id,
          home: fx.home,
          away: fx.away,
          home_name: fx.home_name,
          away_name: fx.away_name,
          kickoff: fx.kickoff,
        });
        for (const ev of feed.events) {
          const k = keyOf(ev);
          if (sent.has(k)) continue;
          sent.add(k);
          await stream.writeSSE({ data: JSON.stringify(ev) });
        }
        await stream.sleep(12_000);
        await stream.writeSSE({ event: "ping", data: "1" });
      }
      return;
    }

    for (const ev of recentCommentary(id)) {
      await stream.writeSSE({ data: JSON.stringify(ev) });
    }
    const handler = (line: unknown) => {
      stream.writeSSE({ data: JSON.stringify(line) }).catch(() => {});
    };
    bus.on(`match:${id}`, handler);
    stream.onAbort(() => {
      bus.off(`match:${id}`, handler);
    });
    while (!stream.aborted) {
      await stream.sleep(15000);
      await stream.writeSSE({ event: "ping", data: "1" });
    }
  });
});

const port = Number(process.env.PORT ?? 8080);
const server = serve({ fetch: app.fetch, port });
injectWebSocket(server);
// Keep the Redis subscriber running as the sim fallback even in real mode.
void startRedisSubscriber();
console.log(`[bff] listening on http://localhost:${port} (data source: ${USE_REAL ? "real (football-data.org)" : "sim/redis"})`);

export { app };
