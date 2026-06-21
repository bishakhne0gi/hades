// Author: Bishakh
// Scoreboard uses a WEBSOCKET — the BFF pushes the full snapshot on every change.
// Rows are clickable: clicking broadcasts a `wc:select-match` event that the
// Match Center micro-frontend listens for (a browser-native cross-MFE event bus).
import { useEffect, useState } from "react";
import { Panel, Score, LiveBadge } from "@wc/ui";
import type { ScoreboardMatch, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

const rank = (s: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);

function statusLabel(m: ScoreboardMatch): string {
  if (m.status === "live") return `${m.minute}'`;
  if (m.status === "finished") return "FT";
  if (m.kickoff) {
    const d = new Date(m.kickoff);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  return "Upcoming";
}

function selectMatch(m: ScoreboardMatch) {
  window.dispatchEvent(
    new CustomEvent("wc:select-match", { detail: { id: m.fixture_id, home: m.home, away: m.away } }),
  );
}

export default function App() {
  const [rows, setRows] = useState<ScoreboardMatch[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch(`${BFF}/bff/scoreboard`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<ScoreboardMatch[]>) => setRows(e.data))
      .catch(() => {});

    const ws = new WebSocket(`${BFF.replace(/^http/, "ws")}/bff/ws/scoreboard`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (m) => {
      try {
        setRows((JSON.parse(m.data) as TimestampedEnvelope<ScoreboardMatch[]>).data);
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, []);

  const sorted = [...rows].sort((a, b) => rank(a.status) - rank(b.status) || a.fixture_id - b.fixture_id);

  return (
    <Panel title="Scoreboard · WebSocket" badge={<LiveBadge live={connected} />}>
      <div style={{ display: "grid", gap: 6 }}>
        {sorted.map((m) => (
          <button
            key={m.fixture_id}
            onClick={() => selectMatch(m)}
            title="Show this match in the Match Center"
            style={{
              textAlign: "left",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #1f2a37",
              padding: "8px 4px",
              cursor: "pointer",
              color: "inherit",
              borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#161c26")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Score home={m.home} away={m.away} hs={m.home_score} as={m.away_score} homeCrest={m.home_crest} awayCrest={m.away_crest} />
            <div style={{ fontSize: 11, color: m.status === "live" ? "#39d353" : "#8b9bb4", textAlign: "center", marginTop: 2 }}>
              {statusLabel(m)}
              {m.group ? ` · Grp ${m.group}` : ""}
            </div>
          </button>
        ))}
        {rows.length === 0 && <div style={{ color: "#8b9bb4" }}>Connecting…</div>}
      </div>
    </Panel>
  );
}
