// Author: Bishakh
// Wraps a lazily-loaded remote so a failure in one micro-frontend never blanks
// the whole page (per-remote error boundary + suspense fallback).
import { Component, Suspense, type ComponentType, type ReactNode } from "react";
import { tokens } from "@wc/ui";

class Boundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div
          style={{
            padding: tokens.space.cardPadding,
            color: tokens.color.accent,
            background: tokens.color.surface,
            border: `1px dashed ${tokens.color.borderStrong}`,
            borderRadius: tokens.radius.card,
            fontFamily: tokens.font.display,
            fontSize: 14,
          }}
        >
          “{this.props.name}” is temporarily unavailable.
        </div>
      );
    }
    return this.props.children;
  }
}

// A remote may accept arbitrary props (e.g. matchCenter takes `matchId`); we keep
// the component type loose so the slot can forward them through.
export function RemoteSlot<P extends object>({
  name,
  Remote,
  remoteProps,
}: {
  name: string;
  Remote: ComponentType<P>;
  remoteProps?: P;
}) {
  // CLS fix: reserve a min-height so the panel keeps its space while the remote
  // loads — the layout doesn't jump when the federated module finally renders.
  return (
    <div style={{ minHeight: 220 }}>
      <Boundary name={name}>
        <Suspense
          fallback={
            <div
              style={{
                padding: tokens.space.cardPadding,
                color: tokens.color.textMuted,
                fontFamily: tokens.font.mono,
                fontSize: 13,
                letterSpacing: "0.04em",
              }}
            >
              Loading {name}…
            </div>
          }
        >
          <Remote {...(remoteProps ?? ({} as P))} />
        </Suspense>
      </Boundary>
    </div>
  );
}
