// Author: Bishakh
// Shared contracts between the BFF and the micro-frontends.
//
// These view-models are shaped by the BFF from the real football-data.org WC
// feed (or the local simulator). The frontend only ever sees these shapes.

export type MatchStatus = "live" | "finished" | "scheduled";

export interface Team {
  id: number;
  name: string;
  code: string; // 3-letter, e.g. "ARG"
  group: string; // "A".."L"
}

export interface Fixture {
  id: number;
  home_team_id: number;
  away_team_id: number;
  kickoff: string; // ISO datetime
  status: string; // "scheduled" | "live" | "finished"
}

/** A single live event in a match (mirrors the simulator's MatchEvent). */
export interface MatchEvent {
  minute: number;
  type: "kickoff" | "goal" | "card" | "commentary";
  team_code: string | null;
  text: string;
}

/**
 * One match as shown across the hub (scoreboard rows, fixtures grid).
 * `home`/`away` are 3-letter codes; `*_name` are full team names.
 * `home_score`/`away_score` are null for matches that haven't started.
 */
export interface FixtureView {
  id: number;
  home: string; // team code, e.g. "ARG"
  away: string;
  home_name: string;
  away_name: string;
  home_crest?: string; // badge/flag image URL
  away_crest?: string;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  minute?: number | null; // live minute when status === "live"
  kickoff: string; // ISO datetime
  group: string; // "A".."L"; "" for knockout matches
  stage: string; // "GROUP_STAGE" | "LAST_16" | "QUARTER_FINALS" | ...
  matchday?: number;
  venue?: string;
}

/**
 * Scoreboard MFE view-model.
 * @deprecated Prefer FixtureView. Kept so older code compiles; the BFF emits
 * FixtureView-compatible objects (extra fields are ignored by old consumers).
 */
export interface ScoreboardMatch {
  fixture_id: number;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  minute: number;
  status: string;
  group?: string;
  kickoff?: string;
  home_crest?: string;
  away_crest?: string;
}

/** Standings MFE view-model — one row of a group table. */
export interface StandingRow {
  team: string; // team code
  team_name?: string;
  crest?: string;
  group: string; // "A".."L"
  position?: number; // 1-based rank within the group (from the feed)
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for?: number;
  goals_against?: number;
  goal_difference?: number;
  points: number;
  form?: string; // e.g. "W,W,D,L"
}

/** A two-sided score line (full time, half time, extra time, penalties). */
export interface ScoreLine {
  home: number | null;
  away: number | null;
}

export interface Referee {
  name: string;
  role?: string;
  nationality?: string;
}

export interface MatchOdds {
  home_win?: number;
  draw?: number;
  away_win?: number;
}

// ── Rich detail (from API-Football, when an APIFOOTBALL_KEY is configured) ────

export interface LineupPlayer {
  name: string;
  number?: number;
  pos?: string; // "G" | "D" | "M" | "F"
  grid?: string; // "row:col" pitch coordinate
}

/** A team's starting XI + bench + formation (e.g. "4-3-3"). */
export interface TeamLineup {
  team: string; // team name
  formation?: string;
  coach?: string;
  startXI: LineupPlayer[];
  subs: LineupPlayer[];
}

/** One match statistic compared across the two teams (e.g. Ball Possession). */
export interface MatchStatistic {
  type: string; // "Ball Possession", "Total Shots", "Corner Kicks", ...
  home: string | number | null;
  away: string | number | null;
}

/**
 * Full match detail for the Match Center.
 *
 * The base fields (score breakdown, venue, referees, odds) come from
 * football-data.org. When an API-Football key is configured, `events`,
 * `lineups` and `statistics` are enriched with REAL play-by-play, formations
 * and possession/shot stats for matches that have been played.
 */
export interface MatchDetail {
  fixture: FixtureView;
  score: {
    halftime?: ScoreLine;
    fulltime?: ScoreLine;
    extratime?: ScoreLine;
    penalties?: ScoreLine;
  };
  venue?: string;
  referees: Referee[];
  odds?: MatchOdds;
  /** Play-by-play events (goals, cards, subs). Empty when no source provides them. */
  events: MatchEvent[];
  /** Starting XI, bench and formation per side (API-Football). */
  lineups?: { home?: TeamLineup; away?: TeamLineup };
  /** Possession, shots, corners, etc. compared home vs away (API-Football). */
  statistics?: MatchStatistic[];
  /** Where the rich detail came from, for an honest UI note. */
  detail_source?: "api-football" | "espn" | "none";
}

/** News MFE view-model. */
export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  published_at: string; // ISO datetime
}

export interface TimestampedEnvelope<T> {
  data: T;
  generated_at: string; // ISO datetime, set by the BFF
}
