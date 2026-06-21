// Author: Bishakh
import { useEffect, useState } from "react";
import { Panel } from "@wc/ui";
import type { NewsItem, TimestampedEnvelope } from "@wc/types";

const BFF = import.meta.env.VITE_BFF_URL ?? "http://localhost:8080";

export default function App() {
  const [items, setItems] = useState<NewsItem[]>([]);
  useEffect(() => {
    fetch(`${BFF}/bff/news`)
      .then((r) => r.json())
      .then((e: TimestampedEnvelope<NewsItem[]>) => setItems(e.data))
      .catch(() => setItems([]));
  }, []);
  return (
    <Panel title="News & Highlights">
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((n) => (
          <article key={n.id} style={{ borderBottom: "1px solid #1f2a37", paddingBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{n.title}</div>
            <div style={{ fontSize: 13, color: "#8b9bb4" }}>{n.summary}</div>
          </article>
        ))}
        {items.length === 0 && <div style={{ color: "#8b9bb4" }}>No news yet.</div>}
      </div>
    </Panel>
  );
}
