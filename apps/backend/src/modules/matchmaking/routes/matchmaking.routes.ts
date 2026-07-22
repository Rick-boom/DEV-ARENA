import { Router, type Router as RouterType } from 'express';
import { requireAuth } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import type { MatchmakingController } from '../controllers/matchmaking.controller.js';
import type { LeaderboardController } from '../controllers/leaderboard.controller.js';
import {
  joinQueueSchema,
  leaderboardQuerySchema,
  ratingHistoryQuerySchema,
} from '../validators/matchmaking.schemas.js';

/** All routes require auth. Literal leaderboard paths precede generic ones. */
export function buildMatchmakingRouter(
  mm: MatchmakingController,
  lb: LeaderboardController,
): RouterType {
  const router = Router();
  router.use(requireAuth);

  router.post('/queue/join', validate('body', joinQueueSchema), mm.join);
  router.post('/queue/leave', mm.leave);
  router.get('/queue/status', mm.status);
  router.post('/queue/reconnect', mm.reconnect);

  router.get('/leaderboard/global', validate('query', leaderboardQuerySchema), lb.global);
  router.get('/leaderboard/friends', validate('query', leaderboardQuerySchema), lb.friends);
  router.get('/leaderboard', validate('query', leaderboardQuerySchema), lb.board);

  router.get('/rating/history', validate('query', ratingHistoryQuerySchema), lb.ratingHistory);

  return router;
}
