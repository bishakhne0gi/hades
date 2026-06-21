// Author: Bishakh
// Wraps a lazily-loaded remote so a failure in one micro-frontend never blanks
// the whole page (per-remote error boundary + suspense fallback).
import { Component, Suspense, type ComponentType, type ReactNode } from "react";

class Boundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ padding: 16, color: "#f0883e", border: "1px dashed #3d2a14", borderRadius: 12 }}>
          “{this.props.name}” is temporarily unavailable.
        </div>
      );
    }
    return this.props.children;
  }
}

export function RemoteSlot({ name, Remote }: { name: string; Remote: ComponentType }) {
  return (
    <Boundary name={name}>
      <Suspense fallback={<div style={{ padding: 16, color: "#8b9bb4" }}>Loading {name}…</div>}>
        <Remote />
      </Suspense>
    </Boundary>
  );
}
