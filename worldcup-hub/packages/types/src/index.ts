// Author: Bishakh
// Shared contracts between the BFF and the micro-frontends.

export interface Team {
  id: number;
  name: string;
  code: string; // 3-letter, e.g. "ARG"
  group: string; // "A".."H"
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

/** Scoreboard MFE view-model (shaped by the BFF). */
export interface ScoreboardMatch {
  fixture_id: number;
  home: string; // team code
  away: string; // team code
  home_score: number;
  away_score: number;
  minute: number;
  status: string; // "live" | "finished" | "scheduled"
  group?: string;
  kickoff?: string; // ISO datetime for upcoming matches
  home_crest?: string; // flag/badge image URL (real feeds); empty for sim
  away_crest?: string;
}

/** Standings MFE view-model. */
export interface StandingRow {
  team: string; // team code
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
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
