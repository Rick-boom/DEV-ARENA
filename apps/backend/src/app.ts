import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.route.js';
import { requestLogger } from './middlewares/request-logger.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import type { ICacheService } from './lib/cache.js';
import { createProblemModule } from './modules/problems/container.js';
import { createBattleModule } from './modules/battles/container.js';
import { createMatchmakingModule } from './modules/matchmaking/container.js';
import { createJudgeModule } from './modules/judge/container.js';
import { judgeOpenApiPaths } from './modules/judge/docs/judge.openapi.js';
import { matchmakingOpenApiPaths } from './modules/matchmaking/docs/matchmaking.openapi.js';
import { createAiCoachModule } from './modules/ai-coach/container.js';
import { aiCoachOpenApiPaths } from './modules/ai-coach/docs/ai.openapi.js';
import type { ILLMClient } from './modules/ai-coach/interfaces/ai.interfaces.js';
import type { IQueuePublisher } from './modules/battles/gateway/rating-publisher.adapter.js';
import { openApiSpec } from './docs/openapi.js';
import { battleOpenApiPaths } from './modules/battles/docs/battle.openapi.js';

/**
 * App factory. Dependencies (prisma, cache) are INJECTED so tests can
 * pass fakes and never touch a real database or Redis. index.ts
 * composes the production graph.
 */
export interface AppDependencies {
  prisma: PrismaClient;
  cache: ICacheService;
  /** Optional — enables the Battle Engine when a Redis client is provided. */
  redis?: Redis;
  ratingQueue?: IQueuePublisher;
  io?: Server;
  /** Optional — enables Matchmaking + Leaderboards when a pub Redis client is provided. */
  pubClient?: Redis;
  /** Optional — enables the AI Coach when Redis is present; Gemini key or an injected LLM. */
  geminiApiKey?: string;
  aiLlm?: ILLMClient;
  /** Optional — enables the Judge Service when set (execution engine base URL). */
  executionEngineUrl?: string;
}

export function createApp(deps: AppDependencies): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' })); // test-case uploads need headroom
  app.use(requestLogger);

  const problemModule = createProblemModule(deps.prisma, deps.cache);

  app.use('/api/v1', healthRouter);
  app.use('/api/v1', problemModule.publicRouter);
  app.use('/api/v1/admin', problemModule.adminRouter);

  // Battle Engine mounts only when its infrastructure is wired in.
  if (deps.redis && deps.ratingQueue) {
    const battleModule = createBattleModule({
      prisma: deps.prisma,
      redis: deps.redis,
      ratingQueue: deps.ratingQueue,
      io: deps.io,
    });
    app.use('/api/v1', battleModule.router);
  }

  // Matchmaking + Leaderboard Engine mounts when Redis (+ a pub client) is wired.
  if (deps.redis && deps.pubClient) {
    const matchmakingModule = createMatchmakingModule({
      prisma: deps.prisma,
      redis: deps.redis,
      pubClient: deps.pubClient,
      io: deps.io,
    });
    app.use('/api/v1', matchmakingModule.router);
  }

  // AI Coach mounts when Redis is available (LLM via Gemini key or injection).
  if (deps.redis) {
    const aiCoachModule = createAiCoachModule({
      prisma: deps.prisma,
      redis: deps.redis,
      geminiApiKey: deps.geminiApiKey,
      llm: deps.aiLlm,
    });
    app.use('/api/v1', aiCoachModule.router);
  }

  // Judge Service mounts when Redis is available (execution URL optional).
  if (deps.redis) {
    const judgeModule = createJudgeModule({
      prisma: deps.prisma,
      redis: deps.redis,
      bullConnection: deps.redis,
      pubClient: deps.pubClient,
      executionEngineUrl: deps.executionEngineUrl ?? 'http://localhost:4200',
    });
    app.use('/api/v1', judgeModule.router);
  }

  const fullSpec = {
    ...openApiSpec,
    paths: {
      ...openApiSpec.paths,
      ...battleOpenApiPaths,
      ...matchmakingOpenApiPaths,
      ...aiCoachOpenApiPaths,
      ...judgeOpenApiPaths,
    },
  };
  app.get('/api/v1/docs.json', (_req, res) => {
    res.json(fullSpec);
  });
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(fullSpec as never));

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  app.use(errorMiddleware);

  return app;
}
