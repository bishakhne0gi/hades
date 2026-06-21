// Author: Bishakh
// The public edge: the only thing exposed. It terminates TLS (in prod), checks
// JWTs, rate-limits, negotiates content, and serves an edge cache — rejecting bad
// traffic and offloading reads BEFORE anything reaches the private origin.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt, sign } from "hono/jwt";
import { getCached, isCacheable, setCached } from "./cache.js";
import { takeToken } from "./rateLimit.js";

const UPSTREAM = process.env.BFF_URL ?? "http://localhost:8080";
const SECRET = process.env.EDGE_JWT_SECRET ?? "dev-edge-secret";
const CACHE_TTL_MS = 5000;

const app = new Hono();
app.use("*", cors());

app.get("/edge/health", (c) => c.json({ status: "ok" }));

// Dev convenience: mint a short-lived demo token. In production this lives in
// a real identity provider — the edge only *verifies*.
app.post("/edge/token", async (c) => {
  const token = await sign({ sub: "demo-fan", role: "viewer", exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
  return c.json({ token });
});

// 1) Rate limit every /bff/* request (per client) before doing any real work.
app.use("/bff/*", async (c, next) => {
  const key = c.req.header("x-forwarded-for") ?? "local";
  const r = takeToken(key);
  c.header("X-RateLimit-Remaining", String(r.remaining));
  if (!r.allowed) {
    c.header("Retry-After", String(r.retryAfter));
    return c.json({ error: "rate_limited" }, 429);
  }
  return next();
});

// 2) JWT auth for JSON routes. Streaming endpoints (SSE/WS) negotiate auth
//    differently (token in query / separate handshake), so we exempt them here.
const auth = jwt({ secret: SECRET, alg: "HS256" });
app.use("/bff/*", async (c, next) => {
  const p = c.req.path;
  if (p.startsWith("/bff/sse/") || p.startsWith("/bff/ws/")) return next();
  return auth(c, next);
});

// 3) Proxy to the origin with an edge cache + content negotiation.
app.all("/bff/*", async (c) => {
  const path = c.req.path;
  const qs = new URL(c.req.url).search;
  const wantsCsv = (c.req.header("accept") ?? "").includes("text/csv");
  const cacheKey = `${path}${qs}|${wantsCsv ? "csv" : "json"}`;

  if (c.req.method === "GET" && isCacheable(path)) {
    const hit = getCached(cacheKey);
    if (hit) {
      return c.body(hit.body, 200, { "Content-Type": hit.contentType, "X-Edge-Cache": "HIT", Vary: "Accept" });
    }
  }

  const upstream = await fetch(`${UPSTREAM}${path}${qs}`, {
    method: c.req.method,
    headers: { "content-type": c.req.header("content-type") ?? "application/json" },
    body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.text(),
  });

  const upstreamType = upstream.headers.get("content-type") ?? "";
  // Streaming (SSE) passes straight through, never cached.
  if (upstreamType.includes("text/event-stream")) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstreamType, "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  let body = await upstream.text();
  let contentType = upstreamType || "application/json";

  // Content negotiation: serve standings as CSV when the client asks for it.
  if (path === "/bff/standings" && wantsCsv) {
    const rows = (JSON.parse(body).data ?? []) as Array<Record<string, unknown>>;
    const header = "team,group,played,won,drawn,lost,points";
    const lines = rows.map((r) => `${r.team},${r.group},${r.played},${r.won},${r.drawn},${r.lost},${r.points}`);
    body = [header, ...lines].join("\n");
    contentType = "text/csv";
  }

  if (c.req.method === "GET" && isCacheable(path)) {
    setCached(cacheKey, body, contentType, CACHE_TTL_MS);
  }

  return c.body(body, upstream.status as 200, {
    "Content-Type": contentType,
    "X-Edge-Cache": isCacheable(path) ? "MISS" : "BYPASS",
    Vary: "Accept",
  });
});

const port = Number(process.env.PORT ?? 8888);
serve({ fetch: app.fetch, port });
console.log(`[edge] listening on http://localhost:${port} → upstream ${UPSTREAM}`);

export { app };
