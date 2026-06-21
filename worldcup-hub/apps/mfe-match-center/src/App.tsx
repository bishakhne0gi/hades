// Author: Bishakh
import { useEffect, useState } from "react";
import { Panel } from "@wc/ui";
import type { MatchEvent, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";
type MatchPayload = { fixture: { id: number; home: string; away: string; group: string }; events: MatchEvent[] };

export default function App() {
  const [data, setData] = useState<MatchPayload | null>(null);
  useEffect(() => {
    fetch(`${BFF}/bff/match/1`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<MatchPayload>) => setData(e.data))
      .catch(() => setData(null));
  }, []);
  return (
    <Panel title="Match Center">
      {data ? (
        <>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            {data.fixture.home} vs {data.fixture.away}
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, maxHeight: 240, overflow: "auto" }}>
            {data.events.map((ev, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                <span style={{ color: "#8b9bb4" }}>{ev.minute}'</span> {ev.text}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div style={{ color: "#8b9bb4" }}>Loading feed…</div>
      )}
    </Panel>
  );
}
