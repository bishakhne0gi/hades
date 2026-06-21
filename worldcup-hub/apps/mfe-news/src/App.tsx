// Author: Bishakh
// News & Highlights — a simple editorial list in the Aura Platform LIGHT theme.
//
// Fetches GET /bff/news (TimestampedEnvelope<NewsItem[]>) and renders an
// editorial list: Inter semibold headline, Playfair body summary, JetBrains
// Mono published date. Subtle dividers + hover, light surfaces throughout.
import { useEffect, useState } from "react";
import { tokens, useAuraFonts, Panel, SectionTitle } from "@wc/ui";
import type { NewsItem, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

// One-time injected stylesheet for hover (inline styles can't do :hover).
const STYLE_ID = "aura-news-style";
function useInjectedStyle() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
      .news-item { transition: background 140ms ease; border-radius: ${tokens.radius.control}px; }
      .news-item:hover { background: ${tokens.color.surfaceMuted}; }
    `;
    document.head.appendChild(el);
  }, []);
}

/** Mono date label, e.g. "Jun 21, 2026". */
function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function NewsRow({ item, last }: { item: NewsItem; last: boolean }) {
  return (
    <article
      className="news-item"
      style={{
        padding: "16px 12px",
        borderBottom: last ? "none" : `1px solid ${tokens.color.border}`,
        display: "grid",
        gap: 6,
      }}
    >
      <time
        dateTime={item.published_at}
        style={{
          fontFamily: tokens.font.mono,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: tokens.color.primary,
        }}
      >
        {dateLabel(item.published_at)}
      </time>
      <h3
        style={{
          margin: 0,
          fontFamily: tokens.font.display,
          fontWeight: 600,
          fontSize: 18,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
          color: tokens.color.textPrimary,
        }}
      >
        {item.title}
      </h3>
      <p
        style={{
          margin: 0,
          fontFamily: tokens.font.body,
          fontSize: tokens.type.bodyMd.fontSize,
          lineHeight: tokens.type.bodyMd.lineHeight,
          color: tokens.color.textSecondary,
        }}
      >
        {item.summary}
      </p>
    </article>
  );
}

export default function App() {
  useAuraFonts();
  useInjectedStyle();

  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${BFF}/bff/news`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<NewsItem[]>) => {
        if (alive && Array.isArray(e.data)) setItems(e.data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <SectionTitle
          eyebrow="FIFA World Cup"
          title="News &"
          accent="Highlights"
          description="The latest from around the tournament."
          style={{ marginBottom: 24 }}
        />

        <Panel>
          {loading && items.length === 0 ? (
            <div style={{ color: tokens.color.textSecondary, padding: "8px 12px" }}>
              Loading news…
            </div>
          ) : items.length === 0 ? (
            <div style={{ color: tokens.color.textSecondary, padding: "8px 12px" }}>
              No news yet.
            </div>
          ) : (
            <div>
              {items.map((n, i) => (
                <NewsRow key={n.id} item={n} last={i === items.length - 1} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
