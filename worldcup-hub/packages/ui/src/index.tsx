// Author: Bishakh
// Shared design system for every micro-frontend — the "Aura Platform" light theme.
//
// This package is the single source of truth for the whole-UI revamp to the
// Aura aesthetic: a polished, editorial light theme. Components style the data
// shapes from @wc/types (FixtureView, StandingRow, MatchDetail, …).
//
// Aura tokens (from aura-platform-1-DESIGN.md):
//   primary #FF5C00 · accent #E55300 · secondary #666666 · background #F8F9F9
//   text-primary #111827 · text-secondary #4B5563
//   Inter (display/UI) · Playfair Display (editorial body) · JetBrains Mono (labels)
//
// NOTE on the surface fix: the design doc declares `surface: #666666`, which is a
// mid-grey — unusable as a card background in a LIGHT theme (it would read as a
// dark slab on a near-white page and destroy the contrast pattern the doc asks
// us to preserve). We therefore map the *card surface* to white (#FFFFFF) on the
// #F8F9F9 background with a subtle 1px border, and keep #666666 in its correct
// role as a muted "secondary" foreground (labels, metadata). This honours the
// doc's intent ("keep background/surface/text/border roles distinct") while
// staying a genuine light theme as the guardrails require.
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// 1. tokens — single source of truth
// ---------------------------------------------------------------------------

export const tokens = {
  color: {
    primary: "#FF5C00",
    accent: "#E55300", // darker orange — hover/active
    secondary: "#666666", // muted foreground (metadata)
    background: "#F8F9F9",
    surface: "#FFFFFF", // card surface (doc's #666666 is wrong for light mode)
    surfaceMuted: "#F1F2F3", // very light fills (rows, chips)
    textPrimary: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#6B7280",
    border: "#E5E7EB", // light grey hairline
    borderStrong: "#D1D5DB",
    live: "#FF5C00", // LIVE uses the brand orange
    success: "#16A34A",
    white: "#FFFFFF",
  },
  font: {
    // Inter for display/UI, Playfair for editorial body, JetBrains Mono for labels.
    display:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    body:
      '"Playfair Display", Georgia, "Times New Roman", serif',
    mono:
      '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  // Type scale from the doc.
  type: {
    displayLg: { fontSize: 64, fontWeight: 500, lineHeight: 1.04, letterSpacing: "-0.02em" },
    displayMd: { fontSize: 40, fontWeight: 500, lineHeight: 1.08, letterSpacing: "-0.01em" },
    displaySm: { fontSize: 28, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em" },
    bodyMd: { fontSize: 16, fontWeight: 400, lineHeight: 1.6 },
    labelMd: { fontSize: 12, fontWeight: 600, lineHeight: 1.2, letterSpacing: "0.08em" },
  },
  space: {
    base: 8,
    gap: 16,
    cardPadding: 24,
    sectionPadding: 80,
  },
  radius: {
    card: 8,
    control: 8,
    pill: 9999,
  },
  shadow: {
    // Soft, HTML-matched depth for white cards on a near-white background.
    sm: "0 1px 2px rgba(17, 24, 39, 0.04), 0 1px 3px rgba(17, 24, 39, 0.06)",
    md: "0 1px 2px rgba(17, 24, 39, 0.04), 0 8px 24px rgba(17, 24, 39, 0.06)",
    lg: "0 12px 32px rgba(17, 24, 39, 0.10), 0 2px 8px rgba(17, 24, 39, 0.05)",
    primary: "0 8px 24px rgba(255, 92, 0, 0.28)",
  },
} as const;

export type Tokens = typeof tokens;

// ---------------------------------------------------------------------------
// 2. useAuraFonts — inject Google Fonts + base stylesheet once (idempotent)
// ---------------------------------------------------------------------------

const FONTS_LINK_ID = "aura-fonts-link";
const BASE_STYLE_ID = "aura-base-style";

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  "family=Inter:wght@400;500;600;700;800&" +
  "family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&" +
  "family=JetBrains+Mono:wght@400;500;600;700&display=swap";

const BASE_CSS = `
  :root { color-scheme: light; }

  .aura-fade-in-up {
    opacity: 0;
    transform: translateY(14px);
    animation: aura-fade-in-up 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes aura-fade-in-up {
    to { opacity: 1; transform: translateY(0); }
  }

  /* Masked reveal — text wipes up from a clipped baseline. */
  .aura-reveal {
    clip-path: inset(0 0 100% 0);
    animation: aura-reveal 760ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes aura-reveal {
    to { clip-path: inset(0 0 -10% 0); }
  }

  /* Hover lift — restrained, smooth easing. */
  .aura-hover-lift {
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
                border-color 220ms ease;
    will-change: transform;
  }
  .aura-hover-lift:hover {
    transform: translateY(-3px);
    box-shadow: ${tokens.shadow.lg};
    border-color: ${tokens.color.borderStrong};
  }

  /* Pulsing LIVE dot. */
  .aura-live-dot {
    position: relative;
    display: inline-block;
    width: 7px; height: 7px;
    border-radius: 9999px;
    background: ${tokens.color.primary};
  }
  .aura-live-dot::after {
    content: "";
    position: absolute; inset: 0;
    border-radius: 9999px;
    background: ${tokens.color.primary};
    animation: aura-pulse 1.6s ease-out infinite;
  }
  @keyframes aura-pulse {
    0%   { transform: scale(1);   opacity: 0.55; }
    100% { transform: scale(3.2); opacity: 0; }
  }

  .aura-btn { transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
              background 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
  .aura-btn:hover { transform: translateY(-2px); }
  .aura-btn:active { transform: translateY(0); }
  .aura-btn-primary:hover { background: ${tokens.color.accent}; box-shadow: ${tokens.shadow.primary}; }
  .aura-btn-secondary:hover { border-color: ${tokens.color.primary}; color: ${tokens.color.primary}; }

  /* Focus ring in primary — accessible, on-brand. */
  .aura-focusable:focus-visible,
  .aura-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(255, 92, 0, 0.35);
  }

  @media (prefers-reduced-motion: reduce) {
    .aura-fade-in-up, .aura-reveal { animation: none; opacity: 1; transform: none; clip-path: none; }
    .aura-hover-lift, .aura-btn { transition: none; }
    .aura-live-dot::after { animation: none; }
  }
`;

/**
 * Inject the Aura Google Fonts and base stylesheet exactly once per document.
 * Safe to call from every component / MFE root; guarded by element id.
 */
export function useAuraFonts(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!document.getElementById(FONTS_LINK_ID)) {
      // Preconnect for faster font fetches.
      const pre1 = document.createElement("link");
      pre1.rel = "preconnect";
      pre1.href = "https://fonts.googleapis.com";
      document.head.appendChild(pre1);

      const pre2 = document.createElement("link");
      pre2.rel = "preconnect";
      pre2.href = "https://fonts.gstatic.com";
      pre2.crossOrigin = "anonymous";
      document.head.appendChild(pre2);

      const link = document.createElement("link");
      link.id = FONTS_LINK_ID;
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_HREF;
      document.head.appendChild(link);
    }

    if (!document.getElementById(BASE_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = BASE_STYLE_ID;
      style.textContent = BASE_CSS;
      document.head.appendChild(style);
    }
  }, []);
}

// ---------------------------------------------------------------------------
// 3. Panel — light card
// ---------------------------------------------------------------------------

export interface PanelProps {
  title?: string;
  badge?: ReactNode;
  children: ReactNode;
  /** Enable the hover-lift interaction (default off for static content). */
  hoverLift?: boolean;
  style?: CSSProperties;
}

const labelStyle: CSSProperties = {
  fontFamily: tokens.font.mono,
  fontSize: tokens.type.labelMd.fontSize,
  fontWeight: tokens.type.labelMd.fontWeight,
  letterSpacing: tokens.type.labelMd.letterSpacing,
  lineHeight: tokens.type.labelMd.lineHeight,
  textTransform: "uppercase",
  color: tokens.color.secondary,
};

export function Panel({ title, badge, children, hoverLift = false, style }: PanelProps) {
  useAuraFonts();
  return (
    <section
      className={hoverLift ? "aura-hover-lift" : undefined}
      aria-label={title}
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        padding: tokens.space.cardPadding,
        color: tokens.color.textPrimary,
        fontFamily: tokens.font.display,
        boxShadow: tokens.shadow.md,
        ...style,
      }}
    >
      {(title || badge) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: tokens.space.gap,
          }}
        >
          {title ? <span style={labelStyle}>{title}</span> : <span />}
          {badge}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Button — primary / secondary / ghost
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Pill radius instead of the control radius. */
  pill?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: CSSProperties;
}

function buttonStyle(variant: ButtonVariant, pill: boolean): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: tokens.font.display,
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1,
    padding: "12px 20px",
    borderRadius: pill ? tokens.radius.pill : tokens.radius.control,
    cursor: "pointer",
    textDecoration: "none",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };
  if (variant === "primary") {
    return {
      ...base,
      background: tokens.color.primary,
      color: tokens.color.white,
      boxShadow: "0 1px 2px rgba(17,24,39,0.08)",
    };
  }
  if (variant === "secondary") {
    return {
      ...base,
      background: tokens.color.surface,
      color: tokens.color.textPrimary,
      borderColor: tokens.color.borderStrong,
    };
  }
  // ghost
  return {
    ...base,
    background: "transparent",
    color: tokens.color.textSecondary,
  };
}

export function Button({
  variant = "primary",
  children,
  onClick,
  href,
  pill = false,
  disabled = false,
  type = "button",
  style,
}: ButtonProps) {
  useAuraFonts();
  const className = `aura-btn aura-btn-${variant}`;
  const css: CSSProperties = {
    ...buttonStyle(variant, pill),
    ...(disabled ? { opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" } : null),
    ...style,
  };
  if (href) {
    return (
      <a className={className} href={href} style={css} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button className={className} type={type} onClick={onClick} disabled={disabled} style={css}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 5. Badge / StatusPill — pill badges for match status
// ---------------------------------------------------------------------------

export type BadgeTone = "primary" | "neutral" | "success" | "outline";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Show a pulsing live dot before the label. */
  live?: boolean;
  style?: CSSProperties;
}

function badgeColors(tone: BadgeTone): { bg: string; fg: string; border: string } {
  switch (tone) {
    case "primary":
      return { bg: "rgba(255,92,0,0.10)", fg: tokens.color.accent, border: "rgba(255,92,0,0.22)" };
    case "success":
      return { bg: "rgba(22,163,74,0.10)", fg: tokens.color.success, border: "rgba(22,163,74,0.22)" };
    case "outline":
      return { bg: "transparent", fg: tokens.color.textSecondary, border: tokens.color.border };
    case "neutral":
    default:
      return { bg: tokens.color.surfaceMuted, fg: tokens.color.secondary, border: tokens.color.border };
  }
}

export function Badge({ children, tone = "neutral", live = false, style }: BadgeProps) {
  useAuraFonts();
  const c = badgeColors(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: tokens.font.mono,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: 1,
        padding: "5px 10px",
        borderRadius: tokens.radius.pill,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {live && <span className="aura-live-dot" aria-hidden />}
      {children}
    </span>
  );
}

export interface StatusPillProps {
  status: "live" | "finished" | "scheduled";
  /** Kickoff time / minute label, e.g. "18:00" or "67'". */
  label?: string;
  style?: CSSProperties;
}

/**
 * Status pill for a match: LIVE (pulsing primary), FT (grey), or the kickoff
 * time (mono) for scheduled matches.
 */
export function StatusPill({ status, label, style }: StatusPillProps) {
  if (status === "live") {
    return (
      <Badge tone="primary" live style={style}>
        {label ? label : "LIVE"}
      </Badge>
    );
  }
  if (status === "finished") {
    return (
      <Badge tone="neutral" style={style}>
        {label ?? "FT"}
      </Badge>
    );
  }
  return (
    <Badge tone="outline" style={style}>
      {label ?? "Scheduled"}
    </Badge>
  );
}

/** Back-compat thin wrapper: LIVE pill when `live`, otherwise a muted dash. */
export function LiveBadge({ live }: { live: boolean }) {
  return live ? (
    <StatusPill status="live" />
  ) : (
    <Badge tone="outline">—</Badge>
  );
}

// ---------------------------------------------------------------------------
// 6. Flag — crest image else flag emoji
// ---------------------------------------------------------------------------

// FIFA 3-letter (and a few full names) → flag emoji. Covers the sim demo plus
// common World Cup nations and the WC 2026 sides seen in the feed; unknown codes
// simply render no flag.
const FLAGS: Record<string, string> = {
  ARG: "🇦🇷", BRA: "🇧🇷", FRA: "🇫🇷", ESP: "🇪🇸", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", GER: "🇩🇪", POR: "🇵🇹", NED: "🇳🇱",
  USA: "🇺🇸", MEX: "🇲🇽", CAN: "🇨🇦", ITA: "🇮🇹", BEL: "🇧🇪", CRO: "🇭🇷", URU: "🇺🇾", COL: "🇨🇴",
  JPN: "🇯🇵", KOR: "🇰🇷", SEN: "🇸🇳", MAR: "🇲🇦", SUI: "🇨🇭", DEN: "🇩🇰", SRB: "🇷🇸", POL: "🇵🇱",
  AUS: "🇦🇺", GHA: "🇬🇭", CMR: "🇨🇲", ECU: "🇪🇨", QAT: "🇶🇦", IRN: "🇮🇷", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  // WC 2026 nations / additional common sides seen in the feed:
  RSA: "🇿🇦", CZE: "🇨🇿", BIH: "🇧🇦", PAR: "🇵🇾", HAI: "🇭🇹", TUR: "🇹🇷", NGA: "🇳🇬", EGY: "🇪🇬",
  TUN: "🇹🇳", ALG: "🇩🇿", CIV: "🇨🇮", NZL: "🇳🇿", KSA: "🇸🇦", UZB: "🇺🇿", JOR: "🇯🇴", PER: "🇵🇪",
  CHI: "🇨🇱", VEN: "🇻🇪", BOL: "🇧🇴", PAN: "🇵🇦", CRC: "🇨🇷", HON: "🇭🇳", SVK: "🇸🇰", AUT: "🇦🇹",
  SWE: "🇸🇪", NOR: "🇳🇴", UKR: "🇺🇦", GRE: "🇬🇷", ROU: "🇷🇴", HUN: "🇭🇺", IRL: "🇮🇪", NIR: "🏴󠁧󠁢󠁮󠁩󠁲󠁿",
  CPV: "🇨🇻", ANG: "🇦🇴", COD: "🇨🇩", CUW: "🇨🇼", SUR: "🇸🇷", IDN: "🇮🇩", IRQ: "🇮🇶", UAE: "🇦🇪",
};

export function flagEmoji(code: string): string {
  return FLAGS[(code ?? "").toUpperCase()] ?? "";
}

/** Renders a crest image if a URL is given, else a flag emoji, else nothing. */
export function Flag({ code, crest, size = 22 }: { code: string; crest?: string; size?: number }) {
  if (crest) {
    return (
      <img
        src={crest}
        alt={code}
        width={size}
        height={size}
        loading="lazy"
        style={{ objectFit: "contain", verticalAlign: "middle", display: "inline-block" }}
      />
    );
  }
  const emoji = flagEmoji(code);
  return emoji ? <span style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span> : null;
}

// ---------------------------------------------------------------------------
// 7. TeamLabel — flag/crest + code + optional full name
// ---------------------------------------------------------------------------

export interface TeamLabelProps {
  code: string;
  name?: string;
  crest?: string;
  size?: number;
  /** Place the flag after the label (for the right/away side of a fixture). */
  reverse?: boolean;
  style?: CSSProperties;
}

export function TeamLabel({ code, name, crest, size = 22, reverse = false, style }: TeamLabelProps) {
  const flag = <Flag code={code} crest={crest} size={size} />;
  const text = (
    <span style={{ minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
      <span
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.01em",
          color: tokens.color.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {code}
      </span>
      {name && (
        <span
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 400,
            fontSize: 12,
            color: tokens.color.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
      )}
    </span>
  );
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        flexDirection: reverse ? "row-reverse" : "row",
        ...style,
      }}
    >
      {flag}
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 8. Score — restyled big tabular-nums scoreline
// ---------------------------------------------------------------------------

export interface ScoreProps {
  home: string;
  away: string;
  hs: number | null;
  as: number | null;
  homeCrest?: string;
  awayCrest?: string;
  /** Optional full names rendered under the codes. */
  homeName?: string;
  awayName?: string;
  /** Status drives whether the separator reads as a score or kickoff dash. */
  status?: "live" | "finished" | "scheduled";
}

export function Score({
  home,
  away,
  hs,
  as: awayScore,
  homeCrest,
  awayCrest,
  homeName,
  awayName,
  status,
}: ScoreProps) {
  useAuraFonts();
  const hasScore = hs != null && awayScore != null && status !== "scheduled";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.space.gap,
      }}
    >
      <TeamLabel code={home} name={homeName} crest={homeCrest} style={{ flex: 1 }} />
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: "0.01em",
          color: tokens.color.textPrimary,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {hasScore ? (
          <>
            <span>{hs}</span>
            <span style={{ color: tokens.color.border }}>:</span>
            <span>{awayScore}</span>
          </>
        ) : (
          <span style={{ fontSize: 18, color: tokens.color.textMuted }}>vs</span>
        )}
      </span>
      <TeamLabel
        code={away}
        name={awayName}
        crest={awayCrest}
        reverse
        style={{ flex: 1, justifyContent: "flex-end" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Eyebrow / SectionTitle — editorial heading block
// ---------------------------------------------------------------------------

export interface EyebrowProps {
  children: ReactNode;
  style?: CSSProperties;
}

/** Small mono uppercase kicker, primary-coloured. */
export function Eyebrow({ children, style }: EyebrowProps) {
  useAuraFonts();
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: tokens.font.mono,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: tokens.color.primary,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export interface SectionTitleProps {
  /** Mono uppercase eyebrow above the heading. */
  eyebrow?: ReactNode;
  /** Main heading text (Inter display). */
  title: ReactNode;
  /** Optional accent fragment rendered in Playfair italic after the title. */
  accent?: ReactNode;
  /** Supporting body copy (Playfair) under the heading. */
  description?: ReactNode;
  /** Right-aligned content (e.g. actions). */
  aside?: ReactNode;
  /** Animate the title with a masked reveal on mount. */
  animate?: boolean;
  style?: CSSProperties;
}

/**
 * Editorial section header: mono eyebrow + large Inter display heading, with an
 * optional Playfair italic accent word and supporting body copy.
 */
export function SectionTitle({
  eyebrow,
  title,
  accent,
  description,
  aside,
  animate = false,
  style,
}: SectionTitleProps) {
  useAuraFonts();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: tokens.space.gap,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && <Eyebrow style={{ marginBottom: 12 }}>{eyebrow}</Eyebrow>}
        <h2
          className={animate ? "aura-reveal" : undefined}
          style={{
            margin: 0,
            fontFamily: tokens.font.display,
            fontSize: tokens.type.displayMd.fontSize,
            fontWeight: tokens.type.displayMd.fontWeight,
            lineHeight: tokens.type.displayMd.lineHeight,
            letterSpacing: tokens.type.displayMd.letterSpacing,
            color: tokens.color.textPrimary,
          }}
        >
          {title}
          {accent && (
            <span
              style={{
                fontFamily: tokens.font.body,
                fontStyle: "italic",
                fontWeight: 400,
                color: tokens.color.primary,
              }}
            >
              {" "}
              {accent}
            </span>
          )}
        </h2>
        {description && (
          <p
            style={{
              margin: "12px 0 0",
              maxWidth: 560,
              fontFamily: tokens.font.body,
              fontSize: tokens.type.bodyMd.fontSize,
              fontWeight: tokens.type.bodyMd.fontWeight,
              lineHeight: tokens.type.bodyMd.lineHeight,
              color: tokens.color.textSecondary,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {aside && <div style={{ flexShrink: 0 }}>{aside}</div>}
    </div>
  );
}
