// Author: Bishakh
// Standings uses POLLING — a plain interval re-fetch. Simple, cache-friendly,
// and fine for data that changes slowly relative to live scores.
//
// UI: redesigned to mimic Apple's "Apple Sports" app — a polished dark theme
// with rounded, elevated cards, system fonts, bold team abbreviations, muted
// secondary stats, and a dominant PTS column. Standings are grouped by their
// World Cup group (the "divisions"); the top 2 of each group are highlighted
// as the knockout-qualification zone.
import { useEffect, useMemo, useState } from "react";
import { flagEmoji } from "@wc/ui";
import type { StandingRow, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";
const POLL_MS = 8000;

// ---- Apple Sports palette ------------------------------------------------
const COLORS = {
  bg: "#000000",
  card: "#1c1c1e",
  cardBorder: "rgba(255,255,255,0.06)",
  divider: "rgba(255,255,255,0.08)",
  text: "#ffffff",
  textSecondary: "#8e8e93",
  textTertiary: "#636366",
  accentGreen: "#30d158", // iOS green — qualification zone
  accentBlue: "#0a84ff", // iOS blue
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

// Group the flat rows by division and sort within each group.
type Group = { letter: string; rows: StandingRow[] };

function groupByDivision(rows: StandingRow[]): Group[] {
  const map = new Map<string, StandingRow[]>();
  for (const r of rows) {
    const arr = map.get(r.group) ?? [];
    arr.push(r);
    map.set(r.group, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, groupRows]) => ({
      letter,
      rows: [...groupRows].sort(
        (a, b) => b.points - a.points || b.won - a.won || a.team.localeCompare(b.team),
      ),
    }));
}

// One-time injected stylesheet for things inline styles can't do (hover, fonts).
const STYLE_ID = "apple-sports-standings-style";
function useInjectedStyle() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
      .as-row { transition: background 120ms ease; }
      .as-row:hover { background: rgba(255,255,255,0.04); }
      .as-grid { max-width: 760px; margin: 0 auto; padding: 0 16px 64px; }
      @media (max-width: 520px) {
        .as-hide-sm { display: none !important; }
      }
    `;
    document.head.appendChild(el);
  }, []);
}

const STAT_COLS: { key: keyof StandingRow; label: string }[] = [
  { key: "played", label: "P" },
  { key: "won", label: "W" },
  { key: "drawn", label: "D" },
  { key: "lost", label: "L" },
];

// Shared grid template: rank | team | P W D L | PTS
const GRID =
  "28px minmax(0,1fr) repeat(4, 34px) 52px";

function HeaderRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        alignItems: "center",
        gap: 4,
        padding: "0 16px 8px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: COLORS.textTertiary,
      }}
    >
      <span style={{ textAlign: "center" }}>#</span>
      <span>Team</span>
      {STAT_COLS.map((c) => (
        <span key={c.key} className={c.key === "played" ? undefined : "as-hide-sm"} style={{ textAlign: "center" }}>
          {c.label}
        </span>
      ))}
      <span style={{ textAlign: "right" }}>PTS</span>
    </div>
  );
}

function TeamRow({ row, rank, qualified }: { row: StandingRow; rank: number; qualified: boolean }) {
  const flag = flagEmoji(row.team);
  return (
    <div
      className="as-row"
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        alignItems: "center",
        gap: 4,
        padding: "12px 16px",
        borderTop: `1px solid ${COLORS.divider}`,
      }}
    >
      {/* Rank with qualification accent */}
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 3,
            height: 18,
            borderRadius: 2,
            background: qualified ? COLORS.accentGreen : "transparent",
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: qualified ? COLORS.text : COLORS.textSecondary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rank}
        </span>
      </span>

      {/* Flag + bold team code */}
      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {flag && <span style={{ fontSize: 22, lineHeight: 1 }}>{flag}</span>}
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: 0.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.team}
        </span>
      </span>

      {/* Secondary stats — muted */}
      {STAT_COLS.map((c) => (
        <span
          key={c.key}
          className={c.key === "played" ? undefined : "as-hide-sm"}
          style={{
            textAlign: "center",
            fontSize: 14,
            color: COLORS.textSecondary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {row[c.key]}
        </span>
      ))}

      {/* Dominant PTS column */}
      <span
        style={{
          textAlign: "right",
          fontSize: 17,
          fontWeight: 800,
          color: COLORS.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {row.points}
      </span>
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <section style={{ marginBottom: 28 }} aria-label={`Group ${group.letter}`}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          margin: "0 4px 12px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: -0.3 }}>
          Group {group.letter}
        </h2>
      </div>
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 18,
          padding: "16px 0 6px",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <HeaderRow />
        {group.rows.map((row, i) => (
          <TeamRow key={row.team} row={row} rank={i + 1} qualified={i < 2} />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  useInjectedStyle();
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

  const groups = useMemo(() => groupByDivision(rows), [rows]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: FONT,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div className="as-grid">
        {/* Apple Sports-style header */}
        <header style={{ padding: "40px 4px 28px" }}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: COLORS.accentGreen,
            }}
          >
            FIFA World Cup
          </p>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1, color: COLORS.text }}>
            Standings
          </h1>
        </header>

        {groups.length === 0 ? (
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 18,
              padding: 32,
              textAlign: "center",
              color: COLORS.textSecondary,
              fontSize: 15,
            }}
          >
            No standings yet.
          </div>
        ) : (
          <>
            {groups.map((g) => (
              <GroupCard key={g.letter} group={g} />
            ))}

            {/* Legend for the qualification accent */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                margin: "8px 4px 0",
                color: COLORS.textSecondary,
                fontSize: 13,
              }}
            >
              <span
                aria-hidden
                style={{ width: 3, height: 14, borderRadius: 2, background: COLORS.accentGreen }}
              />
              <span>Top 2 advance to the knockout stage</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
