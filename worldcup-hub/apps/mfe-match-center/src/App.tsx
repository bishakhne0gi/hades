// Author: Bishakh
// Match Center uses SERVER-SENT EVENTS. It shows the selected match's full event
// feed (goals, cards, commentary). Clicking a match in the Scoreboard fires a
// `wc:select-match` window event that this micro-frontend listens for.
import { useEffect, useRef, useState } from "react";
import { Panel, LiveBadge, Flag } from "@wc/ui";
import type { MatchEvent, ScoreboardMatch, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

interface Fixture {
  id: number;
  home: string;
  away: string;
  group: string;
  status: string;
  home_score: number;
  away_score: number;
  home_crest?: string;
  away_crest?: string;
}
type MatchPayload = { fixture: Fixture; events: MatchEvent[] };

const statusText = (s: string) => (s === "live" ? "LIVE" : s === "finished" ? "Full time" : "Upcoming");

export default function App() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [live, setLive] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // Default to the first match, and listen for clicks coming from the Scoreboard.
  useEffect(() => {
    fetch(`${BFF}/bff/scoreboard`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<ScoreboardMatch[]>) => {
        setSelectedId((cur) => cur ?? e.data[0]?.fixture_id ?? null);
      })
      .catch(() => {});

    const onSelect = (ev: Event) => setSelectedId((ev as CustomEvent).detail.id as number);
    window.addEventListener("wc:select-match", onSelect);
    return () => window.removeEventListener("wc:select-match", onSelect);
  }, []);

  // Load the selected match's detail + open its live SSE stream.
  useEffect(() => {
    if (selectedId == null) return;
    setEvents([]);
    fetch(`${BFF}/bff/match/${selectedId}`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<MatchPayload>) => {
        setFixture(e.data.fixture);
        setEvents(e.data.events);
      })
      .catch(() => setFixture(null));

    const es = new EventSource(`${BFF}/bff/sse/match/${selectedId}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (m) => {
      try {
        const ev = JSON.parse(m.data) as MatchEvent;
        setEvents((prev) => [...prev.slice(-80), ev]);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [selectedId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [events]);

  return (
    <Panel title="Match Center · SSE" badge={<LiveBadge live={live} />}>
      {fixture ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 700, fontSize: 16 }}>
            <Flag code={fixture.home} crest={fixture.home_crest} /> {fixture.home}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {fixture.home_score} : {fixture.away_score}
            </span>
            {fixture.away} <Flag code={fixture.away} crest={fixture.away_crest} />
          </div>
          <div style={{ fontSize: 11, color: fixture.status === "live" ? "#39d353" : "#8b9bb4", textAlign: "center", marginBottom: 8 }}>
            {statusText(fixture.status)}
            {fixture.group ? ` · Group ${fixture.group}` : ""}
          </div>
          <ul
            ref={listRef}
            style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}
          >
            {events.map((ev, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                <span style={{ color: "#8b9bb4" }}>{ev.minute}'</span> {ev.text}
              </li>
            ))}
            {events.length === 0 && <li style={{ color: "#8b9bb4" }}>No detailed events for this match.</li>}
          </ul>
          <div style={{ fontSize: 11, color: "#586677", marginTop: 8 }}>↑ Click any match in the Scoreboard to open it here.</div>
        </>
      ) : (
        <div style={{ color: "#8b9bb4" }}>Click a match in the Scoreboard…</div>
      )}
    </Panel>
  );
}
