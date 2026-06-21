// Author: Bishakh
// Core Web Vitals instrumentation. We measure the field metrics that matter:
//   LCP — Largest Contentful Paint (how fast the main content renders)
//   INP — Interaction to Next Paint (how responsive the UI feels)
//   CLS — Cumulative Layout Shift (how much the layout jumps around)
import { onCLS, onINP, onLCP, type Metric } from "web-vitals";

export type VitalName = "LCP" | "INP" | "CLS";
export type VitalSnapshot = Record<VitalName, number | null>;

// Google's "good" thresholds — used to colour the on-screen HUD.
export const THRESHOLDS: Record<VitalName, [good: number, poor: number]> = {
  LCP: [2500, 4000], // ms
  INP: [200, 500], // ms
  CLS: [0.1, 0.25], // unitless
};

export function rating(name: VitalName, value: number): "good" | "needs-improvement" | "poor" {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

/** Subscribe to the three metrics. `report` fires whenever a value updates. */
export function initVitals(report: (name: VitalName, value: number) => void): void {
  const handle = (m: Metric) => report(m.name as VitalName, m.value);
  onLCP(handle);
  onINP(handle);
  onCLS(handle);
}
