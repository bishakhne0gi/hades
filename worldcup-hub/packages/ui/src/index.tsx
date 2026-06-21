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

// FIFA 3-letter (and a few full names) → flag emoji. Covers the sim demo plus
// common World Cup nations; unknown codes simply render no flag.
const FLAGS: Record<string, string> = {
  ARG: "🇦🇷", BRA: "🇧🇷", FRA: "🇫🇷", ESP: "🇪🇸", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", GER: "🇩🇪", POR: "🇵🇹", NED: "🇳🇱",
  USA: "🇺🇸", MEX: "🇲🇽", CAN: "🇨🇦", ITA: "🇮🇹", BEL: "🇧🇪", CRO: "🇭🇷", URU: "🇺🇾", COL: "🇨🇴",
  JPN: "🇯🇵", KOR: "🇰🇷", SEN: "🇸🇳", MAR: "🇲🇦", SUI: "🇨🇭", DEN: "🇩🇰", SRB: "🇷🇸", POL: "🇵🇱",
  AUS: "🇦🇺", GHA: "🇬🇭", CMR: "🇨🇲", ECU: "🇪🇨", QAT: "🇶🇦", IRN: "🇮🇷", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
};

export function flagEmoji(code: string): string {
  return FLAGS[(code ?? "").toUpperCase()] ?? "";
}

/** Renders a crest image if a URL is given, else a flag emoji, else nothing. */
export function Flag({ code, crest, size = 22 }: { code: string; crest?: string; size?: number }) {
  if (crest) {
    return <img src={crest} alt={code} width={size} height={size} style={{ objectFit: "contain", verticalAlign: "middle" }} />;
  }
  const emoji = flagEmoji(code);
  return emoji ? <span style={{ fontSize: size }}>{emoji}</span> : null;
}

export function Score({
  home, away, hs, as: awayScore, homeCrest, awayCrest,
}: { home: string; away: string; hs: number; as: number; homeCrest?: string; awayCrest?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 18, gap: 8 }}>
      <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Flag code={home} crest={homeCrest} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{home}</span>
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, flexShrink: 0 }}>
        {hs} : {awayScore}
      </span>
      <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, minWidth: 0, justifyContent: "flex-end" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{away}</span>
        <Flag code={away} crest={awayCrest} />
      </span>
    </div>
  );
}
