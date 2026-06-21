// Author: Bishakh
// The shell owns layout + routing-by-grid and composes independently-deployed
// remotes at runtime via Module Federation.
import { lazy } from "react";
import { RemoteSlot } from "./RemoteSlot";

const Scoreboard = lazy(() => import("scoreboard/App"));
const MatchCenter = lazy(() => import("matchCenter/App"));
const Standings = lazy(() => import("standings/App"));
const News = lazy(() => import("news/App"));

export function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#e6edf3", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "16px 24px", borderBottom: "1px solid #1f2a37", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 22 }}>⚽</span>
        <h1 style={{ fontSize: 18, margin: 0 }}>World Cup 2026 — Live Hub</h1>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#8b9bb4" }}>shell · module federation</span>
      </header>

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          padding: 24,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <RemoteSlot name="Scoreboard" Remote={Scoreboard} />
        <RemoteSlot name="Match Center" Remote={MatchCenter} />
        <RemoteSlot name="Standings" Remote={Standings} />
        <RemoteSlot name="News" Remote={News} />
      </main>
    </div>
  );
}
