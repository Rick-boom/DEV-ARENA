import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { Queue } from 'bullmq';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { RedisCacheService } from './lib/cache.js';
import { logger } from './lib/logger.js';
import { createBattleModule } from './modules/battles/container.js';
import { createBattleSchedulerWorker } from './modules/battles/scheduler/battle-scheduler.worker.js';
import { createMatchmakingModule } from './modules/matchmaking/container.js';
import { createMatchmakerWorker } from './modules/matchmaking/matcher/matchmaker.worker.js';
import { createJudgeModule } from './modules/judge/container.js';
import { createJudgeWorker } from './modules/judge/queue/judge.worker.js';
import { PrismaSubmissionRepository } from './modules/judge/repositories/prisma-submission.repository.js';
import { RedisEventPublisher } from './modules/judge/events/redis-event-publisher.adapter.js';
import type { IQueuePublisher } from './modules/battles/gateway/rating-publisher.adapter.js';

/**
 * Production composition root: real Prisma + Redis + Socket.IO + BullMQ
 * are built here and injected into the app factory and the Battle
 * Engine. Graceful shutdown closes HTTP first (stop taking traffic),
 * then Socket.IO, the scheduler worker, and datastores.
 */
const cache = new RedisCacheService(redis);

// BullMQ requires a dedicated connection with maxRetriesPerRequest: null.
const bullConnection = redis.duplicate({ maxRetriesPerRequest: null });

// Rating queue the Battle Engine publishes results onto; the (assumed)
// rating service drains it. Adapted to the IQueuePublisher port.
const ratingQueue = new Queue('rating-updates', { connection: bullConnection });
const ratingPublisher: IQueuePublisher = {
  add: async (jobName, data) => {
    await ratingQueue.add(jobName, data);
  },
};

// Dedicated Redis connection for cross-node matchmaking pub/sub.
const pubClient = redis.duplicate();

const server = http.createServer();

export const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  },
});

const app = createApp({
  prisma,
  cache,
  redis,
  ratingQueue: ratingPublisher,
  io,
  pubClient,
  executionEngineUrl: process.env.EXECUTION_ENGINE_URL ?? 'http://localhost:4200',
  geminiApiKey: process.env.GEMINI_API_KEY,
});
server.on('request', app);

// Battle Engine scheduler worker (durable countdown/expiry timers) +
// judge adapter run in-process. In a scaled deployment the worker can
// run as its own process pointed at the same Redis.
const battleModule = createBattleModule({ prisma, redis, ratingQueue: ratingPublisher, io });
const schedulerWorker = createBattleSchedulerWorker(bullConnection, battleModule.service);
// The (assumed) judge service pushes verdicts via battleModule.judge.handle(...).

// Matchmaking + Leaderboard Engine: module (Redis stores + Prisma
// directory) + the BullMQ sweep worker that pairs queued players and
// hands them to the Battle Engine.
const matchmakingModule = createMatchmakingModule({
  prisma,
  redis,
  pubClient,
  io,
  createBattle: async ({ players, mode, rated }) => {
    // Bridge matchmaking → Battle Engine: create a battle for the pair.
    const [hostId] = players;
    const { battle } = await battleModule.service
      .create(
        {
          type: 'ONE_VS_ONE',
          mode: 'ONE_VS_ONE',
          problemId: undefined as unknown as string,
          rated,
          isPrivate: false,
          name: `Ranked ${mode}`,
          capacity: players.length,
        },
        { id: hostId! },
      )
      .catch(() => ({ battle: { id: '' } }));
    return { battleId: battle.id };
  },
});
const matchmaker = createMatchmakerWorker(bullConnection, matchmakingModule.matchmaking);
void matchmaker.start();

// Judge Service: module (repositories + queue + execution gateway) and
// the worker that drains the submission queue and produces verdicts.
// Verdicts for battle submissions are bridged straight into the Battle
// Engine's judge adapter, closing the submit → judge → scoreboard loop.
const judgeModule = createJudgeModule({
  prisma,
  redis,
  bullConnection,
  pubClient,
  executionEngineUrl: process.env.EXECUTION_ENGINE_URL ?? 'http://localhost:4200',
  onVerdict: async (payload) => {
    await battleModule.judge.handle({
      battleId: String(payload.battleId),
      userId: String(payload.userId),
      submissionId: String(payload.submissionId),
      status: String(payload.verdict),
      passed: Number(payload.passed ?? 0),
      total: Number(payload.total ?? 0),
      runtimeMs: Number(payload.runtimeMs ?? 0),
      isFinal: true,
    });
  },
});
const judgeWorker = createJudgeWorker(
  bullConnection,
  judgeModule.judge,
  new PrismaSubmissionRepository(prisma),
  new RedisEventPublisher(pubClient),
);
logger.info('battle + matchmaking + judge engines wired');

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'backend listening');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  io.close();
  server.close(() => {
    void (async () => {
      await schedulerWorker.close();
      await battleModule.scheduler.close();
      await matchmaker.worker.close();
      await matchmaker.queue.close();
      await judgeWorker.worker.close();
      await judgeWorker.dlq.close();
      await judgeModule.queue.close();
      await ratingQueue.close();
      await prisma.$disconnect();
      bullConnection.disconnect();
      pubClient.disconnect();
      redis.disconnect();
      process.exit(0);
    })();
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
