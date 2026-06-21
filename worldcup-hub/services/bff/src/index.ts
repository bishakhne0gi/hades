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
import type { NewsItem, TimestampedEnvelope } from "@wc/types";
import {
  bus,
  computeStandings,
  matchView,
  recentCommentary,
  scoreboardSnapshot,
  startRedisSubscriber,
} from "./realtime.js";

const app = new Hono();
app.use("*", cors());
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const now = () => new Date().toISOString();
function envelope<T>(data: T): TimestampedEnvelope<T> {
  return { data, generated_at: now() };
}

app.get("/bff/health", (c) => c.json({ status: "ok" }));

// Scoreboard: live snapshot built from the match feed (sim or real).
app.get("/bff/scoreboard", (c) => c.json(envelope(scoreboardSnapshot())));

// Standings: computed live from current match state.
app.get("/bff/standings", (c) => c.json(envelope(computeStandings())));

// Match center: fixture meta + commentary feed for one match.
app.get("/bff/match/:id", (c) => {
  const view = matchView(Number(c.req.param("id")));
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
bus.on("scoreboard", () => {
  const msg = JSON.stringify({ data: scoreboardSnapshot() });
  for (const ws of wsClients) {
    try {
      ws.send(msg);
    } catch {
      /* drop on send error */
    }
  }
});

app.get(
  "/bff/ws/scoreboard",
  upgradeWebSocket(() => ({
    onOpen: (_evt, ws) => {
      wsClients.add(ws);
      ws.send(JSON.stringify({ data: scoreboardSnapshot() }));
    },
    onClose: (_evt, ws) => {
      wsClients.delete(ws);
    },
  })),
);

// Match center → SSE: replay recent commentary, then stream new lines live.
app.get("/bff/sse/match/:id", (c) => {
  const id = Number(c.req.param("id"));
  return streamSSE(c, async (stream) => {
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
void startRedisSubscriber();
console.log(`[bff] listening on http://localhost:${port}`);

export { app };
