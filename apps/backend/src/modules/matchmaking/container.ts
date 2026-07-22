import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import type { Router } from 'express';
import { RedisQueueStore } from './store/redis-queue.store.js';
import { RedisLeaderboardStore } from './store/redis-leaderboard.store.js';
import { RedisRatingStore } from './store/redis-rating.store.js';
import { RedisPresenceStore } from './store/redis-presence.store.js';
import { RedisRateLimiter } from './store/redis-rate-limiter.js';
import { PrismaUserDirectory } from './adapters/prisma-user-directory.js';
import { BattleGatewayAdapter } from './gateway/battle-gateway.adapter.js';
import { RedisMatchPublisher } from './gateway/redis-publisher.adapter.js';
import { MatchmakingService } from './services/matchmaking.service.js';
import { RatingService } from './services/rating.service.js';
import { LeaderboardService } from './services/leaderboard.service.js';
import { MatchmakingController } from './controllers/matchmaking.controller.js';
import { LeaderboardController } from './controllers/leaderboard.controller.js';
import { buildMatchmakingRouter } from './routes/matchmaking.routes.js';

/**
 * Composition root for the Matchmaking + Leaderboard module. Builds the
 * Redis-backed stores + Prisma directory, wires the services, and hands
 * back the router plus the services the worker / rating consumer need.
 */
export interface MatchmakingModule {
  router: Router;
  matchmaking: MatchmakingService;
  rating: RatingService;
  leaderboard: LeaderboardService;
}

export function createMatchmakingModule(deps: {
  prisma: PrismaClient;
  redis: Redis;
  pubClient: Redis;
  io?: Server;
  createBattle?: (input: {
    players: string[];
    mode: string;
    rated: boolean;
  }) => Promise<{ battleId: string }>;
}): MatchmakingModule {
  const queueStore = new RedisQueueStore(deps.redis);
  const leaderboardStore = new RedisLeaderboardStore(deps.redis);
  const ratingStore = new RedisRatingStore(deps.redis);
  const presenceStore = new RedisPresenceStore(deps.redis);
  const rateLimiter = new RedisRateLimiter(deps.redis);

  const users = new PrismaUserDirectory(deps.prisma);
  const battleGateway = new BattleGatewayAdapter(deps.createBattle);
  const publisher = new RedisMatchPublisher(deps.pubClient, deps.io);

  const matchmaking = new MatchmakingService(
    queueStore,
    presenceStore,
    users,
    battleGateway,
    publisher,
    rateLimiter,
  );
  const rating = new RatingService(ratingStore, leaderboardStore, users, publisher);
  const leaderboard = new LeaderboardService(leaderboardStore, users);

  const mmController = new MatchmakingController(matchmaking);
  const lbController = new LeaderboardController(leaderboard, rating);

  return {
    router: buildMatchmakingRouter(mmController, lbController),
    matchmaking,
    rating,
    leaderboard,
  };
}
