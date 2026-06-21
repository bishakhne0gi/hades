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
        background: "#0d1117ee",
        border: "1px solid #1f2a37",
        borderRadius: 10,
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        color: "#e6edf3",
      }}
      aria-label="Core Web Vitals"
    >
      {(["LCP", "INP", "CLS"] as VitalName[]).map((name) => {
        const v = vitals[name];
        const color = v === null ? "#8b9bb4" : COLORS[rating(name, v)];
        return (
          <span key={name} style={{ display: "flex", gap: 4 }}>
            <strong style={{ color: "#8b9bb4" }}>{name}</strong>
            <span style={{ color }}>{v === null ? "—" : fmt(name, v)}</span>
          </span>
        );
      })}
    </div>
  );
}
