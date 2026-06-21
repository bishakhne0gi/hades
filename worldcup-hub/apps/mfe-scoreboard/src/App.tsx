// Author: Bishakh
// Fixtures & Live board — the primary World Cup match board.
//
// Shows ALL World Cup fixtures (every match) grouped by group (A..L) plus a
// Knockout section, with filter chips (All / Live / Upcoming / Finished) and a
// group selector. Live scores update in real time over a WebSocket; the full
// fixture list is fetched from the BFF on mount and re-polled every 20s.
//
// Data source of truth: GET /bff/fixtures (TimestampedEnvelope<FixtureView[]>).
// Live deltas: WS /bff/ws/scoreboard pushes { data: FixtureView[] }, merged by id.
// Navigation: clicking a row dispatches a window "wc:navigate" CustomEvent.
import { useEffect, useMemo, useState } from "react";
import {
  tokens,
  useAuraFonts,
  Panel,
  Button,
  Badge,
  StatusPill,
  TeamLabel,
  SectionTitle,
} from "@wc/ui";
import type { FixtureView, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "live" | "upcoming" | "finished";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

function matchesStatusFilter(m: FixtureView, f: StatusFilter): boolean {
  switch (f) {
    case "live":
      return m.status === "live";
    case "upcoming":
      return m.status === "scheduled";
    case "finished":
      return m.status === "finished";
    case "all":
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Labels / helpers
// ---------------------------------------------------------------------------

/** Pretty knockout-stage label from a FixtureView.stage enum. */
function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_32: "Round of 32",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-finals",
    SEMI_FINALS: "Semi-finals",
    THIRD_PLACE: "Third-place Play-off",
    FINAL: "Final",
  };
  if (map[stage]) return map[stage];
  // Fall back to a Title Case of the raw enum.
  return stage
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Mono kickoff label, e.g. "Jun 21, 18:00". */
function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** StatusPill label per status: live minute, "FT", or kickoff time. */
function statusPillLabel(m: FixtureView): string {
  if (m.status === "live") return m.minute != null ? `${m.minute}'` : "LIVE";
  if (m.status === "finished") return "FT";
  return kickoffLabel(m.kickoff);
}

function navigateToMatch(id: number) {
  window.dispatchEvent(
    new CustomEvent("wc:navigate", { detail: { path: "/match/" + id } }),
  );
}

// ---------------------------------------------------------------------------
// WS payload normalisation — the live feed may be FixtureView (real mode, has
// `id`) or the legacy ScoreboardMatch (sim mode, has `fixture_id`). We merge by
// numeric id and only ever update score / minute / status of known fixtures,
// adding any genuinely new ids.
// ---------------------------------------------------------------------------

interface LiveDelta {
  id: number;
  home_score: number | null;
  away_score: number | null;
  status: FixtureView["status"];
  minute: number | null;
}

function toLiveDelta(raw: unknown): LiveDelta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const idVal = typeof o.id === "number" ? o.id : o.fixture_id;
  if (typeof idVal !== "number") return null;
  const status = o.status;
  const validStatus =
    status === "live" || status === "finished" || status === "scheduled"
      ? status
      : "scheduled";
  return {
    id: idVal,
    home_score: typeof o.home_score === "number" ? o.home_score : null,
    away_score: typeof o.away_score === "number" ? o.away_score : null,
    status: validStatus,
    minute: typeof o.minute === "number" ? o.minute : null,
  };
}

// ---------------------------------------------------------------------------
// Match row
// ---------------------------------------------------------------------------

function MatchRow({ m }: { m: FixtureView }) {
  const isLive = m.status === "live";
  const hasScore =
    m.status !== "scheduled" && m.home_score != null && m.away_score != null;

  return (
    <button
      type="button"
      className="aura-hover-lift aura-focusable"
      onClick={() => navigateToMatch(m.id)}
      aria-label={`${m.home_name} vs ${m.away_name} — view match`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderLeft: isLive
          ? `3px solid ${tokens.color.primary}`
          : `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        padding: "14px 16px",
        cursor: "pointer",
        color: tokens.color.textPrimary,
        font: "inherit",
        boxShadow: tokens.shadow.sm,
      }}
    >
      {/* Home */}
      <TeamLabel
        code={m.home}
        name={m.home_name}
        crest={m.home_crest}
        style={{ flex: 1, minWidth: 0 }}
      />

      {/* Score / vs */}
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: "0.02em",
          color: tokens.color.textPrimary,
          flexShrink: 0,
          minWidth: 64,
          textAlign: "center",
        }}
      >
        {hasScore ? (
          <>
            {m.home_score}
            <span style={{ color: tokens.color.border }}> : </span>
            {m.away_score}
          </>
        ) : (
          <span style={{ fontSize: 15, color: tokens.color.textMuted }}>vs</span>
        )}
      </span>

      {/* Away */}
      <TeamLabel
        code={m.away}
        name={m.away_name}
        crest={m.away_crest}
        reverse
        style={{ flex: 1, minWidth: 0, justifyContent: "flex-end" }}
      />

      {/* Status pill */}
      <span style={{ flexShrink: 0, marginLeft: 4, minWidth: 92, textAlign: "right" }}>
        <StatusPill status={m.status} label={statusPillLabel(m)} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section grouping
// ---------------------------------------------------------------------------

interface Section {
  key: string;
  label: string;
  matches: FixtureView[];
}

const byKickoff = (a: FixtureView, b: FixtureView) =>
  new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();

/**
 * Group fixtures into ordered sections: Group A..L (sorted alphabetically), then
 * a Knockout section per distinct stage for fixtures with no group ("").
 */
function buildSections(fixtures: FixtureView[]): Section[] {
  const groups = new Map<string, FixtureView[]>();
  const knockout = new Map<string, FixtureView[]>();

  for (const m of fixtures) {
    if (m.group) {
      const arr = groups.get(m.group) ?? [];
      arr.push(m);
      groups.set(m.group, arr);
    } else {
      const arr = knockout.get(m.stage) ?? [];
      arr.push(m);
      knockout.set(m.stage, arr);
    }
  }

  const sections: Section[] = [];

  for (const g of [...groups.keys()].sort()) {
    sections.push({
      key: `group-${g}`,
      label: `Group ${g}`,
      matches: groups.get(g)!.slice().sort(byKickoff),
    });
  }

  // Knockout sections ordered by earliest kickoff in each stage.
  const koStages = [...knockout.entries()].sort((a, b) => {
    const ea = Math.min(...a[1].map((m) => new Date(m.kickoff).getTime()));
    const eb = Math.min(...b[1].map((m) => new Date(m.kickoff).getTime()));
    return ea - eb;
  });
  for (const [stage, arr] of koStages) {
    sections.push({
      key: `ko-${stage}`,
      label: stageLabel(stage),
      matches: arr.slice().sort(byKickoff),
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <Button
      variant={active ? "primary" : "secondary"}
      pill
      onClick={onClick}
      style={{ padding: "8px 16px", fontSize: 14 }}
    >
      {children}
      {count != null && (
        <span
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 11,
            opacity: 0.8,
            marginLeft: 2,
          }}
        >
          {count}
        </span>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  useAuraFonts();

  const [fixtures, setFixtures] = useState<FixtureView[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all"); // "all" | "A".."L" | "KO"

  // Initial fetch + 20s poll of the full fixture list.
  useEffect(() => {
    let alive = true;

    const load = () =>
      fetch(`${BFF}/bff/fixtures`)
        .then((r) => r.json())
        .then((e: TimestampedEnvelope<FixtureView[]>) => {
          if (!alive) return;
          if (Array.isArray(e.data)) setFixtures(e.data);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setLoading(false);
        });

    load();
    const poll = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, []);

  // Live WS merge — update score/minute/status by id; append unknown ids.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`${BFF.replace(/^http/, "ws")}/bff/ws/scoreboard`);
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data) as { data?: unknown };
          const list = Array.isArray(payload.data) ? payload.data : [];
          const deltas: LiveDelta[] = [];
          const newFixtures: FixtureView[] = [];
          for (const raw of list) {
            const d = toLiveDelta(raw);
            if (d) deltas.push(d);
            // Keep full fixture objects too (real mode is FixtureView-shaped)
            // so we can add any unknown ids with proper labels/groups.
            if (raw && typeof raw === "object" && typeof (raw as FixtureView).id === "number") {
              newFixtures.push(raw as FixtureView);
            }
          }
          if (deltas.length === 0) return;

          setFixtures((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            for (const d of deltas) {
              const existing = byId.get(d.id);
              if (existing) {
                byId.set(d.id, {
                  ...existing,
                  home_score: d.home_score,
                  away_score: d.away_score,
                  status: d.status,
                  minute: d.minute,
                });
              } else {
                // Unknown id — add it if the WS carried a full FixtureView.
                const full = newFixtures.find((f) => f.id === d.id);
                if (full) byId.set(d.id, full);
              }
            }
            return [...byId.values()];
          });
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 3_000); // simple reconnect
      };
    };

    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, []);

  // Derive groups present in the data for the group selector.
  const groupKeys = useMemo(() => {
    const set = new Set<string>();
    let hasKnockout = false;
    for (const m of fixtures) {
      if (m.group) set.add(m.group);
      else hasKnockout = true;
    }
    const keys = [...set].sort();
    return { groups: keys, hasKnockout };
  }, [fixtures]);

  const liveCount = useMemo(
    () => fixtures.filter((m) => m.status === "live").length,
    [fixtures],
  );

  const statusCounts = useMemo(
    () => ({
      all: fixtures.length,
      live: fixtures.filter((m) => m.status === "live").length,
      upcoming: fixtures.filter((m) => m.status === "scheduled").length,
      finished: fixtures.filter((m) => m.status === "finished").length,
    }),
    [fixtures],
  );

  // Apply filters → sections.
  const sections = useMemo(() => {
    let filtered = fixtures.filter((m) => matchesStatusFilter(m, statusFilter));
    if (groupFilter === "KO") {
      filtered = filtered.filter((m) => !m.group);
    } else if (groupFilter !== "all") {
      filtered = filtered.filter((m) => m.group === groupFilter);
    }
    return buildSections(filtered);
  }, [fixtures, statusFilter, groupFilter]);

  const totalShown = useMemo(
    () => sections.reduce((n, s) => n + s.matches.length, 0),
    [sections],
  );

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
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <SectionTitle
          eyebrow="Fixtures"
          title="Every match,"
          accent="live."
          description="All 104 World Cup matches — filter by status or group and follow live scores as they happen."
          aside={
            liveCount > 0 ? (
              <Badge tone="primary" live>
                {liveCount} live now
              </Badge>
            ) : (
              <Badge tone="outline">No live matches</Badge>
            )
          }
          style={{ marginBottom: 28 }}
        />

        {/* Status filter chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.key}
              active={statusFilter === f.key}
              onClick={() => setStatusFilter(f.key)}
              count={statusCounts[f.key]}
            >
              {f.label}
            </Chip>
          ))}
        </div>

        {/* Group selector */}
        {(groupKeys.groups.length > 0 || groupKeys.hasKnockout) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 28,
            }}
          >
            <Chip active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
              All groups
            </Chip>
            {groupKeys.groups.map((g) => (
              <Chip
                key={g}
                active={groupFilter === g}
                onClick={() => setGroupFilter(g)}
              >
                {g}
              </Chip>
            ))}
            {groupKeys.hasKnockout && (
              <Chip active={groupFilter === "KO"} onClick={() => setGroupFilter("KO")}>
                Knockout
              </Chip>
            )}
          </div>
        )}

        {/* Body */}
        {loading && fixtures.length === 0 ? (
          <Panel>
            <div style={{ color: tokens.color.textSecondary, padding: "8px 0" }}>
              Loading fixtures…
            </div>
          </Panel>
        ) : totalShown === 0 ? (
          <Panel>
            <div style={{ color: tokens.color.textSecondary, padding: "8px 0" }}>
              No matches for this filter.
            </div>
          </Panel>
        ) : (
          <div style={{ display: "grid", gap: 32 }}>
            {sections.map((section) => (
              <section key={section.key}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: tokens.font.display,
                      fontSize: tokens.type.displaySm.fontSize,
                      fontWeight: tokens.type.displaySm.fontWeight,
                      letterSpacing: tokens.type.displaySm.letterSpacing,
                      color: tokens.color.textPrimary,
                    }}
                  >
                    {section.label}
                  </h3>
                  <span
                    style={{
                      fontFamily: tokens.font.mono,
                      fontSize: 12,
                      color: tokens.color.textMuted,
                    }}
                  >
                    {section.matches.length} match
                    {section.matches.length === 1 ? "" : "es"}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {section.matches.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
