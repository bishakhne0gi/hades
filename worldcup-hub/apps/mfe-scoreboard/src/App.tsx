// Author: Bishakh
// Scoreboard uses a WEBSOCKET — the BFF pushes the full snapshot on every change.
import { useEffect, useState } from "react";
import { Panel, Score, LiveBadge } from "@wc/ui";
import type { ScoreboardMatch, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

export default function App() {
  const [rows, setRows] = useState<ScoreboardMatch[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initial REST load so the panel is populated before the first push.
    fetch(`${BFF}/bff/scoreboard`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<ScoreboardMatch[]>) => setRows(e.data))
      .catch(() => {});

    const url = `${BFF.replace(/^http/, "ws")}/bff/ws/scoreboard`;
    const ws = new WebSocket(url);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as TimestampedEnvelope<ScoreboardMatch[]>;
        setRows(e.data);
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, []);

  return (
    <Panel title="Scoreboard · WebSocket" badge={<LiveBadge live={connected} />}>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((m) => (
          <div key={m.fixture_id} style={{ borderBottom: "1px solid #1f2a37", paddingBottom: 8 }}>
            <Score home={m.home} away={m.away} hs={m.home_score} as={m.away_score} />
            <div style={{ fontSize: 11, color: "#8b9bb4", textAlign: "center" }}>
              {m.status === "live" ? `${m.minute}'` : m.status}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: "#8b9bb4" }}>Connecting…</div>}
      </div>
    </Panel>
  );
}
