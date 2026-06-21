// Author: Bishakh
// Standings uses POLLING — a plain interval re-fetch. Simple, cache-friendly,
// and fine for data that changes slowly relative to live scores.
import { useEffect, useState } from "react";
import { Panel } from "@wc/ui";
import type { StandingRow, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";
const POLL_MS = 8000;

export default function App() {
  const [rows, setRows] = useState<StandingRow[]>([]);
  useEffect(() => {
    const load = () =>
      fetch(`${BFF}/bff/standings`)
        .then((r) => r.json())
        .then((e: TimestampedEnvelope<StandingRow[]>) => setRows(e.data))
        .catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <Panel title="Standings · Polling">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "#8b9bb4", textAlign: "left" }}>
            <th>Team</th><th>Grp</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team} style={{ borderTop: "1px solid #1f2a37" }}>
              <td style={{ fontWeight: 600 }}>{r.team}</td>
              <td>{r.group}</td><td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td>
              <td style={{ fontWeight: 700 }}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ color: "#8b9bb4" }}>No standings yet.</div>}
    </Panel>
  );
}
