import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Router } from 'express';
import { HttpExecutionEngineAdapter } from './repositories/http-execution-engine.adapter.js';
import { PrismaSubmissionRepository } from './repositories/prisma-submission.repository.js';
import { PrismaProblemRepository } from './repositories/prisma-problem.repository.js';
import {
  RedisDuplicateGuard,
  RedisRateLimiter,
  RedisTimeline,
} from './repositories/redis-support.adapters.js';
import {
  RedisEventPublisher,
  BattleBridgePublisher,
} from './events/redis-event-publisher.adapter.js';
import { BullJudgeQueue } from './queue/judge.queue.js';
import { JudgeService } from './services/judge.service.js';
import { SubmissionService } from './services/submission.service.js';
import { JudgeController } from './controllers/judge.controller.js';
import { buildJudgeRouter } from './routes/judge.routes.js';
import type { IExecutionEngine } from './interfaces/judge.interfaces.js';

/**
 * Composition root for the Judge Service. Builds the execution adapter,
 * Prisma repositories, Redis support adapters, the BullMQ queue, and
 * wires both halves: the API-facing SubmissionService and the worker-
 * facing JudgeService. Only here do concretions meet.
 */
export interface JudgeModule {
  router: Router;
  judge: JudgeService;
  submissions: SubmissionService;
  queue: BullJudgeQueue;
}

export function createJudgeModule(deps: {
  prisma: PrismaClient;
  redis: Redis;
  bullConnection: Redis;
  pubClient?: Redis;
  executionEngineUrl?: string;
  /** inject a fake engine (tests) or an alternate runner */
  executionEngine?: IExecutionEngine;
  /** forward verdicts into the in-process Battle Engine */
  onVerdict?: (payload: Record<string, unknown>) => Promise<void> | void;
}): JudgeModule {
  const execution: IExecutionEngine =
    deps.executionEngine ??
    new HttpExecutionEngineAdapter(deps.executionEngineUrl ?? 'http://localhost:4200');

  const submissionRepo = new PrismaSubmissionRepository(deps.prisma);
  const problemRepo = new PrismaProblemRepository(deps.prisma);
  const rateLimiter = new RedisRateLimiter(deps.redis);
  const duplicateGuard = new RedisDuplicateGuard(deps.redis);
  const timeline = new RedisTimeline(deps.redis);

  const redisPublisher = deps.pubClient ? new RedisEventPublisher(deps.pubClient) : undefined;
  const publisher = deps.onVerdict
    ? new BattleBridgePublisher(deps.onVerdict, redisPublisher)
    : (redisPublisher ?? new BattleBridgePublisher(() => undefined));

  const queue = new BullJudgeQueue(deps.bullConnection);

  const judge = new JudgeService(execution, problemRepo, submissionRepo, publisher, timeline);
  const submissions = new SubmissionService(
    submissionRepo,
    problemRepo,
    queue,
    publisher,
    rateLimiter,
    duplicateGuard,
  );
  const controller = new JudgeController(submissions, deps.prisma);

  return { router: buildJudgeRouter(controller), judge, submissions, queue };
}
