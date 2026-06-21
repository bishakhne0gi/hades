// Author: Bishakh
// The shell owns the layout, top navigation and client-side routing, and
// composes independently-deployed remotes at runtime via Module Federation.
// Remotes never see the router — they navigate by dispatching a `wc:navigate`
// CustomEvent, which the <NavBridge/> below translates into router.navigate().
import { lazy, useEffect } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { tokens, useAuraFonts, Eyebrow, Button } from "@wc/ui";
import { RemoteSlot } from "./RemoteSlot";
import { VitalsHud } from "./VitalsHud";

// Lazy federated remotes. matchCenter accepts an optional `matchId` prop.
const Scoreboard = lazy(() => import("scoreboard/App"));
const MatchDetail = lazy(() => import("matchCenter/App"));
const Standings = lazy(() => import("standings/App"));
const News = lazy(() => import("news/App"));

// ---------------------------------------------------------------------------
// NavBridge — turns remote `wc:navigate` events into router navigation.
// Lives inside <BrowserRouter> so it can call useNavigate().
// ---------------------------------------------------------------------------
function NavBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ path?: string }>).detail;
      if (detail?.path) navigate(detail.path);
    };
    window.addEventListener("wc:navigate", onNavigate);
    return () => window.removeEventListener("wc:navigate", onNavigate);
  }, [navigate]);
  return null;
}

// ---------------------------------------------------------------------------
// Hero — tasteful Aura wordmark strip (kept short; this is a data app).
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <header
      style={{
        borderBottom: `1px solid ${tokens.color.border}`,
        background: tokens.color.background,
        padding: "28px 24px 22px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Eyebrow style={{ marginBottom: 10 }}>FIFA World Cup · 2026 · Live</Eyebrow>
        <h1
          style={{
            margin: 0,
            fontFamily: tokens.font.display,
            fontSize: 34,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: tokens.color.textPrimary,
          }}
        >
          World Cup 2026
          <span style={{ color: tokens.color.textMuted, fontWeight: 500 }}> · </span>
          <span
            style={{
              fontFamily: tokens.font.body,
              fontStyle: "italic",
              fontWeight: 400,
              color: tokens.color.primary,
            }}
          >
            Live Hub
          </span>
        </h1>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// NavBar — routed tabs (NavLink) with an active-state pill in the brand color.
// ---------------------------------------------------------------------------
const TABS = [
  { to: "/fixtures", label: "Fixtures" },
  { to: "/standings", label: "Standings" },
  { to: "/news", label: "News" },
] as const;

function NavBar() {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: `${tokens.color.background}f2`,
        backdropFilter: "saturate(180%) blur(8px)",
        borderBottom: `1px solid ${tokens.color.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 24px",
          display: "flex",
          gap: 8,
        }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className="aura-focusable"
            style={({ isActive }) => ({
              fontFamily: tokens.font.display,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.01em",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: tokens.radius.pill,
              transition: "background 160ms ease, color 160ms ease",
              color: isActive ? tokens.color.white : tokens.color.textSecondary,
              background: isActive ? tokens.color.primary : "transparent",
              boxShadow: isActive ? tokens.shadow.primary : "none",
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Match-detail page — back action + the matchCenter remote bound to the route.
// ---------------------------------------------------------------------------
function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchId = Number(id);
  return (
    <div>
      <div style={{ marginBottom: tokens.space.gap }}>
        <Button variant="ghost" onClick={() => navigate("/fixtures")}>
          ← All fixtures
        </Button>
      </div>
      <RemoteSlot<{ matchId?: number }>
        name="Match detail"
        Remote={MatchDetail}
        remoteProps={Number.isFinite(matchId) ? { matchId } : {}}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell layout — hero + nav + routed content + perf HUD.
// ---------------------------------------------------------------------------
function Shell() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.color.background,
        color: tokens.color.textPrimary,
        fontFamily: tokens.font.display,
      }}
    >
      <Hero />
      <NavBar />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/fixtures" replace />} />
          <Route path="/fixtures" element={<RemoteSlot name="Fixtures" Remote={Scoreboard} />} />
          <Route path="/standings" element={<RemoteSlot name="Standings" Remote={Standings} />} />
          <Route path="/news" element={<RemoteSlot name="News" Remote={News} />} />
          <Route path="/match/:id" element={<MatchPage />} />
          <Route path="*" element={<Navigate to="/fixtures" replace />} />
        </Routes>
      </main>
      <VitalsHud />
    </div>
  );
}

export function App() {
  // Inject Aura fonts + base stylesheet once at the app root.
  useAuraFonts();
  return (
    <BrowserRouter>
      <NavBridge />
      <Shell />
    </BrowserRouter>
  );
}
