/**
 * Matchmaking + leaderboard domain types. String-literal const objects
 * (not TS enums) so they serialize cleanly into Redis and over sockets.
 */

export const MatchMode = {
  ONE_VS_ONE: 'ONE_VS_ONE',
  PRACTICE: 'PRACTICE',
  RANKED: 'RANKED',
} as const;
export type MatchMode = (typeof MatchMode)[keyof typeof MatchMode];

export const Region = {
  GLOBAL: 'GLOBAL',
  NA: 'NA',
  EU: 'EU',
  ASIA: 'ASIA',
} as const;
export type Region = (typeof Region)[keyof typeof Region];

export const SkillPreference = {
  ANY: 'ANY',
  SIMILAR: 'SIMILAR', // tight rating window
  CHALLENGE: 'CHALLENGE', // bias toward higher-rated opponents
} as const;
export type SkillPreference = (typeof SkillPreference)[keyof typeof SkillPreference];

/** A user's queue ticket — stored as a Redis hash, scored in the pool ZSET. */
export interface QueueTicket {
  userId: string;
  rating: number;
  mode: MatchMode;
  region: Region;
  language: string; // preferred problem language
  skill: SkillPreference;
  /** friend match: only pair with this user (private matchmaking) */
  friendId?: string;
  /** invite-based private match code */
  privateCode?: string;
  enqueuedAt: number; // epoch ms — drives window growth + timeout
}

export interface Match {
  matchId: string;
  battleId: string | null;
  mode: MatchMode;
  region: Region;
  players: string[]; // userIds
  createdAt: number;
}

// ── leaderboard ────────────────────────────────────────────────────
export const LeaderboardScope = {
  GLOBAL: 'GLOBAL',
  COUNTRY: 'COUNTRY',
  COLLEGE: 'COLLEGE',
  FRIENDS: 'FRIENDS',
} as const;
export type LeaderboardScope = (typeof LeaderboardScope)[keyof typeof LeaderboardScope];

export const LeaderboardPeriod = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  ALL_TIME: 'ALL_TIME',
} as const;
export type LeaderboardPeriod = (typeof LeaderboardPeriod)[keyof typeof LeaderboardPeriod];

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  score: number;
}

export interface LeaderboardPage {
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  group: string; // "all" | country code | college id | friends-owner id
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ── rating ─────────────────────────────────────────────────────────
export interface RatingStats {
  userId: string;
  current: number;
  peak: number;
  games: number;
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
}

export interface RatingChange {
  userId: string;
  oldRating: number;
  newRating: number;
  change: number;
  reason: string;
  battleId?: string;
  at: number;
}

/** Result of a battle, consumed by the rating service. */
export const MatchOutcome = {
  WIN: 'WIN',
  LOSS: 'LOSS',
  DRAW: 'DRAW',
} as const;
export type MatchOutcome = (typeof MatchOutcome)[keyof typeof MatchOutcome];
