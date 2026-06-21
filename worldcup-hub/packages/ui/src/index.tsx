// Author: Bishakh
// Tiny shared design system used by every micro-frontend, so panels look consistent.
import type { CSSProperties, ReactNode } from "react";

const card: CSSProperties = {
  background: "#10151c",
  border: "1px solid #1f2a37",
  borderRadius: 12,
  padding: 16,
  color: "#e6edf3",
  fontFamily: "system-ui, sans-serif",
};

const titleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "#8b9bb4",
};

export function Panel({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section style={card} aria-label={title}>
      <div style={titleRow}>
        <span>{title}</span>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: live ? "#0b0f14" : "#8b9bb4",
        background: live ? "#39d353" : "#1f2a37",
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {live ? "LIVE" : "—"}
    </span>
  );
}

export function Score({ home, away, hs, as: awayScore }: { home: string; away: string; hs: number; as: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 18 }}>
      <span style={{ fontWeight: 600 }}>{home}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
        {hs} : {awayScore}
      </span>
      <span style={{ fontWeight: 600 }}>{away}</span>
    </div>
  );
}
