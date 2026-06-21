// Author: Bishakh
// Match Center → the **Match Detail page**. Given a match id it renders:
//   • LIVE      → live score + minute + play-by-play commentary (SSE when the
//                 feed provides it; honest empty state when it doesn't).
//   • FINISHED  → the REAL stats the feed exposes: HT/FT/ET/penalty score
//                 breakdown, venue, referees and pre-match odds. We do NOT
//                 fabricate possession / shots / xG (the free tier has none).
//   • SCHEDULED → kickoff info + venue + odds preview.
//
// The id is prop-driven (the shell passes it from /match/:id). Standalone on
// :5002 it falls back to the first live (else first) fixture, and still listens
// for the legacy `wc:select-match` window event. Aura LIGHT theme throughout.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  tokens,
  useAuraFonts,
  Panel,
  Button,
  Badge,
  StatusPill,
  Flag,
  TeamLabel,
  Eyebrow,
} from "@wc/ui";
import type {
  MatchDetail,
  MatchEvent,
  MatchStatistic,
  FixtureView,
  LineupPlayer,
  ScoreLine,
  TeamLineup,
  TimestampedEnvelope,
} from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

// ── helpers ──────────────────────────────────────────────────────────────

function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPillLabel(f: FixtureView): string {
  if (f.status === "live") return f.minute != null ? `LIVE · ${f.minute}'` : "LIVE";
  if (f.status === "finished") return "FT";
  return kickoffLabel(f.kickoff);
}

function eventGlyph(type: MatchEvent["type"]): string {
  if (type === "goal") return "⚽";
  if (type === "card") return "🟨";
  if (type === "kickoff") return "⏱";
  return "•";
}

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Group Stage",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third-place play-off",
  FINAL: "Final",
};

function contextLine(f: FixtureView): string {
  const parts: string[] = [];
  if (f.group) parts.push(`Group ${f.group}`);
  if (f.stage) parts.push(STAGE_LABELS[f.stage] ?? f.stage.replace(/_/g, " "));
  const venue = f.venue;
  if (venue) parts.push(venue);
  return parts.join("  ·  ");
}

// ── small presentational atoms (Aura-styled) ──────────────────────────────

function metaCard(label: string, body: React.ReactNode) {
  return (
    <div
      key={label}
      style={{
        background: tokens.color.surfaceMuted,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        padding: 16,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.mono,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: tokens.color.secondary,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: tokens.font.display, fontSize: 15, color: tokens.color.textPrimary }}>
        {body}
      </div>
    </div>
  );
}

// A single HT/FT/ET/PEN score row.
function scoreRow(label: string, line: ScoreLine, homeCode: string, awayCode: string) {
  return (
    <div
      key={label}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: `1px solid ${tokens.color.border}`,
      }}
    >
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: tokens.color.secondary,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          fontSize: 18,
          color: tokens.color.textPrimary,
          textAlign: "center",
          minWidth: 90,
        }}
      >
        {label === "Penalties" ? "(" : ""}
        {line.home ?? "–"}
        <span style={{ color: tokens.color.border }}> : </span>
        {line.away ?? "–"}
        {label === "Penalties" ? ")" : ""}
      </span>
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontSize: 11,
          color: tokens.color.textMuted,
          textAlign: "right",
        }}
      >
        {homeCode} – {awayCode}
      </span>
    </div>
  );
}

// ── full-screen state shells ──────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  useAuraFonts();
  return (
    <div
      style={{
        minHeight: "100%",
        background: tokens.color.background,
        padding: tokens.space.gap,
        fontFamily: tokens.font.display,
        color: tokens.color.textPrimary,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: tokens.space.gap }}>
        {children}
      </div>
    </div>
  );
}

function viewAllButton() {
  return (
    <Button
      variant="ghost"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("wc:navigate", { detail: { path: "/fixtures" } }))
      }
    >
      View all fixtures →
    </Button>
  );
}

// ── rich-detail panels (real data from ESPN / API-Football) ────────────────

function statNum(v: string | number | null): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function StatRow({ s }: { s: MatchStatistic }) {
  const h = statNum(s.home);
  const a = statNum(s.away);
  const total = h + a;
  const hPct = total > 0 ? (h / total) * 100 : 50;
  return (
    <div style={{ display: "grid", gap: 6, padding: "10px 0", borderBottom: `1px solid ${tokens.color.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", fontFamily: tokens.font.mono }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: tokens.color.textPrimary }}>{s.home ?? "–"}</span>
        <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.color.secondary, textAlign: "center", padding: "0 8px" }}>
          {s.type}
        </span>
        <span style={{ fontWeight: 700, fontSize: 15, color: tokens.color.textPrimary, textAlign: "right" }}>{s.away ?? "–"}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: tokens.color.surfaceMuted }}>
        <div style={{ width: `${hPct}%`, background: tokens.color.primary }} />
        <div style={{ width: `${100 - hPct}%`, background: tokens.color.secondary }} />
      </div>
    </div>
  );
}

function renderStatistics(detail: MatchDetail): React.ReactNode {
  const stats = detail.statistics ?? [];
  if (stats.length === 0) return null;
  const poss = stats.filter((s) => /poss/i.test(s.type));
  const rest = stats.filter((s) => !/poss/i.test(s.type));
  return <Panel title="Match Statistics">{[...poss, ...rest].map((s, i) => <StatRow key={i} s={s} />)}</Panel>;
}

function PlayerRow({ p }: { p: LineupPlayer }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13 }}>
      <span style={{ fontFamily: tokens.font.mono, color: tokens.color.textMuted, minWidth: 22, textAlign: "right" }}>
        {p.number ?? "–"}
      </span>
      <span style={{ color: tokens.color.textPrimary }}>{p.name}</span>
      {p.pos && <span style={{ fontFamily: tokens.font.mono, fontSize: 10, color: tokens.color.secondary }}>{p.pos}</span>}
    </div>
  );
}

function LineupColumn({ team }: { team: TeamLineup }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: tokens.font.display, fontWeight: 700, fontSize: 15, color: tokens.color.textPrimary }}>
          {team.team}
        </span>
        {team.formation && (
          <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.color.primary, fontWeight: 700 }}>
            {team.formation}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gap: 6 }}>{team.startXI.map((p, i) => <PlayerRow key={i} p={p} />)}</div>
      {team.subs.length > 0 && (
        <>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.color.textMuted, margin: "12px 0 6px" }}>
            Substitutes
          </div>
          <div style={{ display: "grid", gap: 5, opacity: 0.65 }}>{team.subs.map((p, i) => <PlayerRow key={i} p={p} />)}</div>
        </>
      )}
      {team.coach && <div style={{ marginTop: 10, fontSize: 12, color: tokens.color.textMuted }}>Coach: {team.coach}</div>}
    </div>
  );
}

function renderLineups(detail: MatchDetail): React.ReactNode {
  const lu = detail.lineups;
  if (!lu || (!lu.home && !lu.away)) return null;
  return (
    <Panel title="Line-ups">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.space.gap }}>
        {lu.home && <LineupColumn team={lu.home} />}
        {lu.away && <LineupColumn team={lu.away} />}
      </div>
    </Panel>
  );
}

function renderKeyEvents(detail: MatchDetail): React.ReactNode {
  const events = (detail.events ?? []).filter((e) => e.type === "goal" || e.type === "card");
  if (events.length === 0) return null;
  return (
    <Panel title="Key Events">
      <div style={{ display: "grid", gap: 8 }}>
        {events.map((ev, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span aria-hidden style={{ fontSize: 15 }}>{eventGlyph(ev.type)}</span>
            <span style={{ fontFamily: tokens.font.mono, fontWeight: 600, color: tokens.color.primary, minWidth: 30 }}>{ev.minute}'</span>
            <span style={{ fontFamily: tokens.font.display, fontSize: 14, color: tokens.color.textPrimary }}>{ev.text}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── component ──────────────────────────────────────────────────────────────

export default function App({ matchId }: { matchId?: number }) {
  useAuraFonts();

  const [resolvedId, setResolvedId] = useState<number | null>(matchId ?? null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"none" | "notfound" | "error">("none");

  // Live commentary, accumulated from SSE (plus any replayed lines).
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // 1. Resolve the id: explicit prop wins; else fall back to first live/first
  //    fixture; also honour the legacy cross-MFE select event.
  useEffect(() => {
    if (matchId != null) {
      setResolvedId(matchId);
      return;
    }
    let cancelled = false;
    fetch(`${BFF}/bff/fixtures`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<FixtureView[]>) => {
        if (cancelled) return;
        const list = e.data ?? [];
        const live = list.find((f) => f.status === "live");
        setResolvedId((cur) => cur ?? live?.id ?? list[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Legacy event bus (harmless extra path to set the id).
  useEffect(() => {
    const onSelect = (ev: Event) => {
      const id = (ev as CustomEvent).detail?.id;
      if (typeof id === "number") setResolvedId(id);
    };
    window.addEventListener("wc:select-match", onSelect);
    return () => window.removeEventListener("wc:select-match", onSelect);
  }, []);

  // 2. Fetch the match detail whenever the id changes.
  useEffect(() => {
    if (resolvedId == null) return;
    let cancelled = false;
    setLoading(true);
    setError("none");
    setDetail(null);
    setLiveEvents([]);

    fetch(`${BFF}/bff/match/${resolvedId}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (!cancelled) {
            setError("notfound");
            setLoading(false);
          }
          return null;
        }
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as TimestampedEnvelope<MatchDetail>;
      })
      .then((e) => {
        if (cancelled || !e) return;
        const d = e.data;
        setDetail(d);
        // Seed the live feed with any events the detail already carries.
        setLiveEvents(d.events ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("error");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedId]);

  const fixture = detail?.fixture ?? null;
  const isLive = fixture?.status === "live";

  // 3. Open the SSE stream ONLY for live matches; close on unmount / id change.
  useEffect(() => {
    if (resolvedId == null || !isLive) return;
    const es = new EventSource(`${BFF}/bff/sse/match/${resolvedId}`);
    es.onmessage = (m) => {
      try {
        const ev = JSON.parse(m.data) as MatchEvent;
        if (ev && typeof ev.minute === "number") {
          // Dedup: the GET seeds the backlog and the SSE re-sends it, so drop
          // any line we already have (keyed by minute + type + text).
          const key = `${ev.minute}|${ev.type}|${ev.text}`;
          setLiveEvents((prev) =>
            prev.some((p) => `${p.minute}|${p.type}|${p.text}` === key)
              ? prev
              : [...prev.slice(-200), ev],
          );
        }
      } catch {
        /* ignore non-JSON / ping frames */
      }
    };
    return () => es.close();
  }, [resolvedId, isLive]);

  // Lightweight periodic refetch while live, to keep score + minute accurate
  // even when the feed sends no commentary (real tier).
  useEffect(() => {
    if (resolvedId == null || !isLive) return;
    const t = setInterval(() => {
      fetch(`${BFF}/bff/match/${resolvedId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((e: TimestampedEnvelope<MatchDetail> | null) => {
          if (e?.data) setDetail((cur) => ({ ...e.data, events: cur?.events ?? e.data.events }));
        })
        .catch(() => {});
    }, 20_000);
    return () => clearInterval(t);
  }, [resolvedId, isLive]);

  // Auto-scroll the commentary feed to the newest line.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [liveEvents]);

  const scoreRows = useMemo(() => {
    if (!detail || !fixture) return [];
    const rows: React.ReactNode[] = [];
    // Sim-mode payloads omit `score`; guard so we never throw.
    const s = detail.score ?? {};
    if (s.halftime) rows.push(scoreRow("Half-time", s.halftime, fixture.home, fixture.away));
    if (s.fulltime) rows.push(scoreRow("Full-time", s.fulltime, fixture.home, fixture.away));
    if (s.extratime) rows.push(scoreRow("Extra-time", s.extratime, fixture.home, fixture.away));
    if (s.penalties) rows.push(scoreRow("Penalties", s.penalties, fixture.home, fixture.away));
    return rows;
  }, [detail, fixture]);

  // ── loading / error / 404 ────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <Panel title="Match Detail">
          <div style={{ color: tokens.color.textMuted, fontFamily: tokens.font.display }}>
            Loading match…
          </div>
        </Panel>
      </Shell>
    );
  }
  if (error === "notfound") {
    return (
      <Shell>
        <Panel title="Match Detail">
          <Eyebrow>404</Eyebrow>
          <h2 style={{ fontFamily: tokens.font.display, margin: "8px 0 4px" }}>Match not found</h2>
          <p style={{ color: tokens.color.textSecondary, fontFamily: tokens.font.body }}>
            We couldn't find a match with id {resolvedId}.
          </p>
          <div style={{ marginTop: 12 }}>{viewAllButton()}</div>
        </Panel>
      </Shell>
    );
  }
  if (error === "error" || !detail || !fixture) {
    return (
      <Shell>
        <Panel title="Match Detail">
          <Eyebrow>Error</Eyebrow>
          <h2 style={{ fontFamily: tokens.font.display, margin: "8px 0 4px" }}>
            Couldn't load this match
          </h2>
          <p style={{ color: tokens.color.textSecondary, fontFamily: tokens.font.body }}>
            The match feed is unavailable right now. Please try again.
          </p>
          <div style={{ marginTop: 12 }}>{viewAllButton()}</div>
        </Panel>
      </Shell>
    );
  }

  const hasScore =
    fixture.home_score != null && fixture.away_score != null && fixture.status !== "scheduled";

  // ── hero scoreline ─────────────────────────────────────────────────────
  const hero = (
    <Panel style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <Eyebrow>Match Detail</Eyebrow>
        <StatusPill status={fixture.status} label={statusPillLabel(fixture)} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: tokens.space.gap,
        }}
      >
        {/* Home */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          <Flag code={fixture.home} crest={fixture.home_crest} size={56} />
          <TeamLabel code={fixture.home} name={fixture.home_name} crest={fixture.home_crest} size={0} style={{ justifyContent: "center" }} />
        </div>

        {/* Score */}
        <div
          style={{
            fontFamily: tokens.font.mono,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            fontSize: hasScore ? 56 : 32,
            letterSpacing: "0.01em",
            color: tokens.color.textPrimary,
            display: "flex",
            alignItems: "center",
            gap: 14,
            whiteSpace: "nowrap",
          }}
        >
          {hasScore ? (
            <>
              <span>{fixture.home_score}</span>
              <span style={{ color: tokens.color.border }}>:</span>
              <span>{fixture.away_score}</span>
            </>
          ) : (
            <span style={{ fontSize: 28, color: tokens.color.textMuted }}>vs</span>
          )}
        </div>

        {/* Away */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          <Flag code={fixture.away} crest={fixture.away_crest} size={56} />
          <TeamLabel code={fixture.away} name={fixture.away_name} crest={fixture.away_crest} size={0} style={{ justifyContent: "center" }} />
        </div>
      </div>

      {contextLine(fixture) && (
        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontFamily: tokens.font.mono,
            fontSize: 12,
            letterSpacing: "0.04em",
            color: tokens.color.textMuted,
          }}
        >
          {contextLine(fixture)}
        </div>
      )}
    </Panel>
  );

  // ── LIVE: commentary panel + (when available) live stats & line-ups ─────
  const liveSection = isLive && (
    <>
    <Panel title="Live Commentary" badge={<Badge tone="primary" live>LIVE</Badge>}>
      {liveEvents.length > 0 ? (
        <div
          ref={feedRef}
          style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}
        >
          {liveEvents.map((ev, i) => {
            const highlight = ev.type === "goal" || ev.type === "card";
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "baseline",
                  padding: "8px 10px",
                  borderRadius: tokens.radius.control,
                  background: highlight ? "rgba(255,92,0,0.06)" : tokens.color.surfaceMuted,
                  border: `1px solid ${highlight ? "rgba(255,92,0,0.18)" : tokens.color.border}`,
                }}
              >
                <span style={{ fontSize: 15 }} aria-hidden>
                  {eventGlyph(ev.type)}
                </span>
                <span
                  style={{
                    fontFamily: tokens.font.mono,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 12,
                    fontWeight: 600,
                    color: tokens.color.primary,
                    minWidth: 30,
                  }}
                >
                  {ev.minute}'
                </span>
                <span style={{ fontFamily: tokens.font.display, fontSize: 14, color: tokens.color.textPrimary }}>
                  {ev.text}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 15,
            color: tokens.color.textSecondary,
            lineHeight: 1.6,
          }}
        >
          Live commentary isn't available for this match feed — score updates live above.
        </div>
      )}
    </Panel>
    {renderStatistics(detail)}
    {renderLineups(detail)}
    </>
  );

  // ── FINISHED: score breakdown + meta ────────────────────────────────────
  const hasRich = !!detail.statistics?.length || !!detail.lineups?.home || !!detail.lineups?.away;
  const finishedSection = fixture.status === "finished" && (
    <>
      {scoreRows.length > 0 && (
        <Panel title="Score Breakdown">
          <div>{scoreRows}</div>
        </Panel>
      )}
      {renderKeyEvents(detail)}
      {renderStatistics(detail)}
      {renderLineups(detail)}
      {renderMeta(detail)}
      {!hasRich && (
        <Panel style={{ padding: 16 }}>
          <div style={{ fontFamily: tokens.font.body, fontSize: 13, color: tokens.color.textMuted, fontStyle: "italic" }}>
            Detailed statistics and line-ups weren't available for this match.
          </div>
        </Panel>
      )}
    </>
  );

  // ── SCHEDULED: kickoff + meta preview ───────────────────────────────────
  const scheduledSection = fixture.status === "scheduled" && (
    <>
      <Panel title="Kick-off">
        <div
          style={{
            fontFamily: tokens.font.display,
            fontSize: 24,
            fontWeight: 600,
            color: tokens.color.textPrimary,
          }}
        >
          {kickoffLabel(fixture.kickoff)}
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: tokens.font.body,
            fontSize: 14,
            color: tokens.color.textMuted,
            fontStyle: "italic",
          }}
        >
          Match hasn't started yet.
        </div>
      </Panel>
      {renderMeta(detail)}
    </>
  );

  return (
    <Shell>
      {hero}
      {liveSection}
      {finishedSection}
      {scheduledSection}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>{viewAllButton()}</div>
    </Shell>
  );
}

// Venue / Referees / Odds — render only what the feed actually provides.
function renderMeta(detail: MatchDetail): React.ReactNode {
  const venue = detail.venue ?? detail.fixture.venue;
  const refs = detail.referees ?? [];
  const odds = detail.odds;
  const hasOdds = !!odds && (odds.home_win != null || odds.draw != null || odds.away_win != null);

  if (!venue && refs.length === 0 && !hasOdds) return null;

  return (
    <Panel title="Match Info">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {venue && metaCard("Venue", venue)}
        {refs.length > 0 &&
          metaCard(
            "Officials",
            <div style={{ display: "grid", gap: 6 }}>
              {refs.map((r, i) => (
                <div key={i} style={{ fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  {r.role ? (
                    <span style={{ color: tokens.color.textMuted }}> · {r.role}</span>
                  ) : null}
                  {r.nationality ? (
                    <span style={{ color: tokens.color.textMuted }}> ({r.nationality})</span>
                  ) : null}
                </div>
              ))}
            </div>,
          )}
        {hasOdds &&
          metaCard(
            "Pre-match Odds",
            <div
              style={{
                display: "flex",
                gap: 16,
                fontFamily: tokens.font.mono,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>
                <span style={{ color: tokens.color.textMuted }}>H </span>
                {odds!.home_win ?? "–"}
              </span>
              <span>
                <span style={{ color: tokens.color.textMuted }}>D </span>
                {odds!.draw ?? "–"}
              </span>
              <span>
                <span style={{ color: tokens.color.textMuted }}>A </span>
                {odds!.away_win ?? "–"}
              </span>
            </div>,
          )}
      </div>
    </Panel>
  );
}
