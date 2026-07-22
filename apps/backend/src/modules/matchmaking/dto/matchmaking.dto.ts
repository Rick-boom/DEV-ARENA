import type { z } from 'zod';
import type {
  joinQueueSchema,
  leaderboardQuerySchema,
  ratingHistoryQuerySchema,
} from '../validators/matchmaking.schemas.js';

export type JoinQueueDto = z.infer<typeof joinQueueSchema>;
export type LeaderboardQueryDto = z.infer<typeof leaderboardQuerySchema>;
export type RatingHistoryQueryDto = z.infer<typeof ratingHistoryQuerySchema>;
