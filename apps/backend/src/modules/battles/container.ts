import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import type { Router } from 'express';
import { BattleRepository } from './repositories/battle.repository.js';
import { RedisBattleStateStore } from './store/redis-battle-state.store.js';
import { RoomService } from './services/room.service.js';
import { BattleService } from './services/battle.service.js';
import { BattleScheduler } from './scheduler/battle.scheduler.js';
import { SocketEmitterAdapter } from './gateway/socket-emitter.adapter.js';
import { RatingEventPublisher, type IQueuePublisher } from './gateway/rating-publisher.adapter.js';
import { JudgeAdapter } from './gateway/judge.adapter.js';
import { BattleController } from './controllers/battle.controller.js';
import { buildBattleRouter } from './routes/battle.routes.js';

/**
 * Composition root for the Battle Engine — the ONLY place concrete
 * classes meet. Everything below depends on interfaces; here we build
 * the real Redis/Prisma/Socket-backed graph and hand back the router
 * (for the API), the service (for the scheduler worker), and the judge
 * adapter (for the judge service to push verdicts into).
 */
export interface BattleModule {
  router: Router;
  service: BattleService;
  judge: JudgeAdapter;
  scheduler: BattleScheduler;
}

export function createBattleModule(deps: {
  prisma: PrismaClient;
  redis: Redis;
  ratingQueue: IQueuePublisher;
  io?: Server;
}): BattleModule {
  const repo = new BattleRepository(deps.prisma);
  const state = new RedisBattleStateStore(deps.redis);
  const rooms = new RoomService();
  const scheduler = new BattleScheduler(deps.redis);
  const sockets = new SocketEmitterAdapter(deps.io);
  const rating = new RatingEventPublisher(deps.ratingQueue);

  const service = new BattleService(repo, state, rooms, scheduler, sockets, rating);
  const judge = new JudgeAdapter(service);
  const controller = new BattleController(service);

  return { router: buildBattleRouter(controller), service, judge, scheduler };
}
