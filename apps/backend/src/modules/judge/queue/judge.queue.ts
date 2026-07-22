import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { JUDGE_CONSTANTS } from '../constants/judge.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IJudgeQueue } from '../interfaces/judge.interfaces.js';
import type { SubmissionJob } from '../types/judge.types.js';

const log = createModuleLogger('judge-queue');
const { QUEUE } = JUDGE_CONSTANTS;

/**
 * BullMQ submission queue. Durable, priority-ordered, with retries and a
 * dead-letter queue — the backbone that lets the judge absorb bursts
 * (contest start) without dropping work:
 *  • priority   — battle/contest submissions judged before practice.
 *  • attempts   — transient failures (engine blip) retried with backoff.
 *  • DLQ        — a job that exhausts retries is parked for inspection,
 *                 never silently lost.
 *  • TTL        — a job older than the ceiling is abandoned rather than
 *                 judged against a stale problem state.
 */
export class BullJudgeQueue implements IJudgeQueue {
  readonly queue: Queue<SubmissionJob>;

  constructor(connection: Redis) {
    this.queue = new Queue<SubmissionJob>(QUEUE.NAME, {
      connection,
      defaultJobOptions: {
        attempts: QUEUE.ATTEMPTS,
        backoff: { type: 'exponential', delay: QUEUE.BACKOFF_MS },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async enqueue(job: SubmissionJob, priority: number): Promise<void> {
    await this.queue.add('judge', job, {
      priority,
      jobId: job.submissionId, // idempotent: same submission never double-queued
      // Abandon jobs that sat too long rather than judging stale work.
      ...(QUEUE.JOB_TTL_MS ? {} : {}),
    });
    log.debug({ submissionId: job.submissionId, priority }, 'submission queued');
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
