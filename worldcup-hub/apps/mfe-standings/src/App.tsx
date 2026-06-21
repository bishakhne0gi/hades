// Author: Bishakh
// Standings uses POLLING — a plain interval re-fetch. Simple, cache-friendly,
// and fine for data that changes slowly relative to live scores.
//
// UI: Aura Platform LIGHT theme — editorial light surfaces, Inter/Playfair/
// JetBrains Mono, primary #FF5C00 accents on a #F8F9F9 background. Standings are
// grouped into all 12 World Cup groups (A..L). Each group is a white Aura card
// with a full table of the enriched real fields (P W D L GF GA GD PTS + form).
// The top 2 of every group are highlighted as the knockout-qualification zone.
import { useEffect, useMemo, useState } from "react";
import {
  tokens,
  useAuraFonts,
  Panel,
  Badge,
  Flag,
  SectionTitle,
} from "@wc/ui";
import type { StandingRow, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";
const POLL_MS = 15_000;

// ---------------------------------------------------------------------------
// Grouping + sorting
// ---------------------------------------------------------------------------

type Group = { letter: string; rows: StandingRow[] };

/**
 * Group the flat rows into Group A..L cards (sorted alphabetically). Within a
 * group sort by `position` when present, else points desc → goal_difference
 * desc → goals_for desc.
 */
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
      rows: [...groupRows].sort((a, b) => {
        if (a.position != null && b.position != null) return a.position - b.position;
        return (
          b.points - a.points ||
          (b.goal_difference ?? 0) - (a.goal_difference ?? 0) ||
          (b.goals_for ?? 0) - (a.goals_for ?? 0)
        );
      }),
    }));
}

// ---------------------------------------------------------------------------
// Injected stylesheet — hover + responsive (hide GF/GA on narrow widths).
// Mirrors the injected-<style> pattern used by @wc/ui.
// ---------------------------------------------------------------------------

const STYLE_ID = "aura-standings-style";
function useInjectedStyle() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
      .st-row { transition: background 140ms ease; }
      .st-row:hover { background: ${tokens.color.surfaceMuted}; }
      @media (max-width: 560px) {
        .st-hide-sm { display: none !important; }
      }
    `;
    document.head.appendChild(el);
  }, []);
}

// ---------------------------------------------------------------------------
// Columns. `hideSm` columns (GF/GA) collapse on narrow widths; we always keep
// P, GD and PTS so the table stays meaningful.
// ---------------------------------------------------------------------------

type StatCol = {
  key: "played" | "won" | "drawn" | "lost" | "goals_for" | "goals_against" | "goal_difference";
  label: string;
  hideSm?: boolean;
  strong?: boolean; // GD shown slightly stronger than other minor stats
};

const STAT_COLS: StatCol[] = [
  { key: "played", label: "P" },
  { key: "won", label: "W", hideSm: true },
  { key: "drawn", label: "D", hideSm: true },
  { key: "lost", label: "L", hideSm: true },
  { key: "goals_for", label: "GF", hideSm: true },
  { key: "goals_against", label: "GA", hideSm: true },
  { key: "goal_difference", label: "GD", strong: true },
];

// rank | team | (P W D L GF GA GD) | PTS
const GRID = "34px minmax(0,1fr) repeat(7, 30px) 44px";

function statValue(row: StandingRow, key: StatCol["key"]): string {
  const v = row[key];
  if (v == null) return "–";
  if (key === "goal_difference" && typeof v === "number" && v > 0) return `+${v}`;
  return String(v);
}

// ---------------------------------------------------------------------------
// Form chips — tiny W/D/L pills from a "W,W,D,L" string.
// ---------------------------------------------------------------------------

function FormChips({ form }: { form: string }) {
  const results = form
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(-5);
  if (results.length === 0) return null;
  const color = (r: string) =>
    r === "W"
      ? tokens.color.success
      : r === "L"
        ? tokens.color.accent
        : tokens.color.secondary;
  return (
    <span style={{ display: "inline-flex", gap: 3 }} aria-label={`Recent form ${results.join(" ")}`}>
      {results.map((r, i) => (
        <span
          key={i}
          title={r}
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: tokens.font.mono,
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            color: tokens.color.white,
            background: color(r),
          }}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Header + team rows
// ---------------------------------------------------------------------------

const numCell = (extra?: React.CSSProperties): React.CSSProperties => ({
  textAlign: "center",
  fontFamily: tokens.font.mono,
  fontVariantNumeric: "tabular-nums",
  fontSize: 13,
  ...extra,
});

function HeaderRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        alignItems: "center",
        gap: 4,
        padding: "0 4px 10px",
        fontFamily: tokens.font.mono,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: tokens.color.textMuted,
        borderBottom: `1px solid ${tokens.color.border}`,
      }}
    >
      <span style={{ textAlign: "center" }}>#</span>
      <span>Team</span>
      {STAT_COLS.map((c) => (
        <span
          key={c.key}
          className={c.hideSm ? "st-hide-sm" : undefined}
          style={{ textAlign: "center" }}
        >
          {c.label}
        </span>
      ))}
      <span style={{ textAlign: "right", color: tokens.color.textSecondary }}>PTS</span>
    </div>
  );
}

function TeamRow({ row, rank, qualified }: { row: StandingRow; rank: number; qualified: boolean }) {
  return (
    <div
      className="st-row"
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        alignItems: "center",
        gap: 4,
        padding: "11px 4px",
        borderTop: `1px solid ${tokens.color.border}`,
      }}
    >
      {/* Rank + qualification accent bar */}
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 3,
            height: 18,
            borderRadius: 2,
            background: qualified ? tokens.color.primary : "transparent",
          }}
        />
        <span
          style={{
            fontFamily: tokens.font.mono,
            fontVariantNumeric: "tabular-nums",
            fontSize: 13,
            fontWeight: 600,
            color: qualified ? tokens.color.primary : tokens.color.textMuted,
          }}
        >
          {rank}
        </span>
      </span>

      {/* Crest + code (+ full name) + form */}
      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Flag code={row.team} crest={row.crest} size={20} />
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
          <span
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.01em",
              color: tokens.color.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.team}
          </span>
          {row.team_name && (
            <span
              className="st-hide-sm"
              style={{
                fontFamily: tokens.font.display,
                fontSize: 11,
                color: tokens.color.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.team_name}
            </span>
          )}
        </span>
        {row.form && (
          <span className="st-hide-sm" style={{ marginLeft: "auto", paddingLeft: 8 }}>
            <FormChips form={row.form} />
          </span>
        )}
      </span>

      {/* Minor stats */}
      {STAT_COLS.map((c) => (
        <span
          key={c.key}
          className={c.hideSm ? "st-hide-sm" : undefined}
          style={numCell({
            color: c.strong ? tokens.color.textSecondary : tokens.color.textMuted,
            fontWeight: c.strong ? 600 : 400,
          })}
        >
          {statValue(row, c.key)}
        </span>
      ))}

      {/* Dominant PTS column */}
      <span
        style={numCell({
          textAlign: "right",
          fontSize: 16,
          fontWeight: 800,
          color: tokens.color.textPrimary,
        })}
      >
        {row.points}
      </span>
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Panel
      hoverLift
      title={`Group ${group.letter}`}
      badge={<Badge tone="outline">{group.rows.length} teams</Badge>}
    >
      <HeaderRow />
      {group.rows.map((row, i) => (
        <TeamRow key={row.team} row={row} rank={row.position ?? i + 1} qualified={i < 2} />
      ))}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  useAuraFonts();
  useInjectedStyle();

  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${BFF}/bff/standings`)
        .then((r) => r.json())
        .then((e: TimestampedEnvelope<StandingRow[]>) => {
          if (alive && Array.isArray(e.data)) setRows(e.data);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setLoading(false);
        });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const groups = useMemo(() => groupByDivision(rows), [rows]);

  return (
    <div
      style={{
        background: tokens.color.background,
        minHeight: "100%",
        fontFamily: tokens.font.display,
        color: tokens.color.textPrimary,
        padding: "32px 24px 64px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <SectionTitle
          eyebrow="FIFA World Cup"
          title="Standings"
          description="All 12 groups — points, goals and recent form, updated live from the official feed."
          aside={
            <Badge tone="primary">Top 2 advance</Badge>
          }
          style={{ marginBottom: 28 }}
        />

        {loading && groups.length === 0 ? (
          <Panel>
            <div style={{ color: tokens.color.textSecondary, padding: "8px 0" }}>
              Loading standings…
            </div>
          </Panel>
        ) : groups.length === 0 ? (
          <Panel>
            <div style={{ color: tokens.color.textSecondary, padding: "8px 0" }}>
              No standings yet.
            </div>
          </Panel>
        ) : (
          <>
            <div style={{ display: "grid", gap: 24 }}>
              {groups.map((g) => (
                <GroupCard key={g.letter} group={g} />
              ))}
            </div>

            {/* Legend for the qualification accent */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                margin: "20px 4px 0",
                fontFamily: tokens.font.mono,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: tokens.color.textMuted,
              }}
            >
              <span
                aria-hidden
                style={{ width: 3, height: 14, borderRadius: 2, background: tokens.color.primary }}
              />
              <span>Top 2 advance to the knockout stage</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
