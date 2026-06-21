// Author: Bishakh
import { useEffect, useState } from "react";
import { Panel, Score, LiveBadge } from "@wc/ui";
import type { ScoreboardMatch, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

export default function App() {
  const [rows, setRows] = useState<ScoreboardMatch[]>([]);
  useEffect(() => {
    fetch(`${BFF}/bff/scoreboard`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<ScoreboardMatch[]>) => setRows(e.data))
      .catch(() => setRows([]));
  }, []);
  return (
    <Panel title="Scoreboard" badge={<LiveBadge live={rows.some((r) => r.status === "live")} />}>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((m) => (
          <div key={m.fixture_id} style={{ borderBottom: "1px solid #1f2a37", paddingBottom: 8 }}>
            <Score home={m.home} away={m.away} hs={m.home_score} as={m.away_score} />
            <div style={{ fontSize: 11, color: "#8b9bb4", textAlign: "center" }}>{m.status}</div>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: "#8b9bb4" }}>No matches yet.</div>}
      </div>
    </Panel>
  );
}
