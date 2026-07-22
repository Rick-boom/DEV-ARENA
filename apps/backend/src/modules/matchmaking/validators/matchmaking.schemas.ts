import { z } from 'zod';
import {
  MatchMode,
  Region,
  SkillPreference,
  LeaderboardScope,
  LeaderboardPeriod,
} from '../types/matchmaking.types.js';

/** Validation boundary for every matchmaking + leaderboard endpoint. */
export const joinQueueSchema = z.object({
  mode: z.nativeEnum(MatchMode).default(MatchMode.ONE_VS_ONE),
  region: z.nativeEnum(Region).default(Region.GLOBAL),
  language: z.string().trim().min(1).max(32).default('javascript'),
  skill: z.nativeEnum(SkillPreference).default(SkillPreference.ANY),
  friendId: z.string().uuid().optional(),
  privateCode: z.string().min(4).max(32).optional(),
});

export const leaderboardQuerySchema = z.object({
  scope: z.nativeEnum(LeaderboardScope).default(LeaderboardScope.GLOBAL),
  period: z.nativeEnum(LeaderboardPeriod).default(LeaderboardPeriod.ALL_TIME),
  country: z.string().length(2).optional(),
  college: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const ratingHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
