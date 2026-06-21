// Author: Bishakh
// Match Center uses SERVER-SENT EVENTS — a one-way live stream of commentary
// lines. The fixture title comes from a one-off REST call; the feed is SSE.
import { useEffect, useRef, useState } from "react";
import { Panel, LiveBadge } from "@wc/ui";
import type { MatchEvent, ScoreboardMatch, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

export default function App() {
  const [title, setTitle] = useState("Match Center");
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [live, setLive] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;

    // Pick whatever the first live fixture is (id is 1 in sim mode, a real id in
    // real-data mode) instead of hard-coding it.
    fetch(`${BFF}/bff/scoreboard`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<ScoreboardMatch[]>) => {
        const first = e.data[0];
        if (!first) {
          setTitle("No live match");
          return;
        }
        const id = first.fixture_id;
        setTitle(`${first.home} vs ${first.away}`);

        es = new EventSource(`${BFF}/bff/sse/match/${id}`);
        es.onopen = () => setLive(true);
        es.onerror = () => setLive(false);
        es.onmessage = (m) => {
          try {
            const ev = JSON.parse(m.data) as MatchEvent;
            setEvents((prev) => [...prev.slice(-60), ev]);
          } catch {
            /* ignore */
          }
        };
      })
      .catch(() => setTitle("No live match"));

    return () => es?.close();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [events]);

  return (
    <Panel title="Match Center · SSE" badge={<LiveBadge live={live} />}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>{title}</div>
      <ul
        ref={listRef}
        style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, maxHeight: 240, overflow: "auto" }}
      >
        {events.map((ev, i) => (
          <li key={i} style={{ fontSize: 13 }}>
            <span style={{ color: "#8b9bb4" }}>{ev.minute}'</span> {ev.text}
          </li>
        ))}
        {events.length === 0 && <li style={{ color: "#8b9bb4" }}>Waiting for kick-off…</li>}
      </ul>
    </Panel>
  );
}
