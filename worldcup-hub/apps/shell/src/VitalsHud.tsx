// Author: Bishakh
// A tiny on-screen HUD that shows live Core Web Vitals, colour-coded by rating.
// Great for demoing "before/after" perf fixes on camera.
import { useEffect, useState } from "react";
import { initVitals, rating, type VitalName, type VitalSnapshot } from "./vitals";

const COLORS = { good: "#39d353", "needs-improvement": "#f0883e", poor: "#f85149" } as const;

function fmt(name: VitalName, v: number): string {
  return name === "CLS" ? v.toFixed(3) : `${Math.round(v)}ms`;
}

export function VitalsHud() {
  const [vitals, setVitals] = useState<VitalSnapshot>({ LCP: null, INP: null, CLS: null });

  useEffect(() => {
    initVitals((name, value) => setVitals((prev) => ({ ...prev, [name]: value })));
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        display: "flex",
        gap: 8,
        padding: "8px 12px",
        background: "#FFFFFFf2",
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(17,24,39,0.04), 0 8px 24px rgba(17,24,39,0.06)",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        color: "#111827",
      }}
      aria-label="Core Web Vitals"
    >
      {(["LCP", "INP", "CLS"] as VitalName[]).map((name) => {
        const v = vitals[name];
        const color = v === null ? "#6B7280" : COLORS[rating(name, v)];
        return (
          <span key={name} style={{ display: "flex", gap: 4 }}>
            <strong style={{ color: "#6B7280" }}>{name}</strong>
            <span style={{ color }}>{v === null ? "—" : fmt(name, v)}</span>
          </span>
        );
      })}
    </div>
  );
}
