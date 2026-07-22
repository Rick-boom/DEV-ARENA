import { Queue, QueueEvents } from 'bullmq';
import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { createModuleLogger } from '../utils/logger.js';
import { QueueFullError } from '../errors/execution-error.js';
import type { ExecutionJobData, ExecutionResult } from '../types/execution.types.js';

const log = createModuleLogger('execution-queue');

export const EXECUTION_JOB_NAME = 'execute';

/**
 * Producer side of the queue. Responsibilities:
 *   • Admission control — reject with QueueFull when depth exceeds the
 *     configured ceiling, so a traffic spike sheds load instead of
 *     exhausting Redis (back-pressure, not collapse).
 *   • Priority — lower number runs sooner (BullMQ convention); battle
 *     submissions can jump ahead of practice runs.
 *   • Retry with backoff — transient container/daemon errors get 2
 *     retries with exponential backoff; deterministic failures don't
 *     benefit from retries and are surfaced immediately by the worker.
 *   • Result retrieval — awaits the worker's returned value via
 *     QueueEvents so the API can offer a synchronous request/response
 *     over an asynchronous queue.
 */
export class ExecutionQueue {
  private readonly queue: Queue<ExecutionJobData, ExecutionResult>;
  private readonly events: QueueEvents;

  constructor(connection: Redis, eventsConnection: Redis) {
    this.queue = new Queue<ExecutionJobData, ExecutionResult>(env.EXECUTION_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3, // 1 try + 2 retries
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: false, // keep failures for the DLQ mover / inspection
      },
    });
    this.events = new QueueEvents(env.EXECUTION_QUEUE_NAME, { connection: eventsConnection });
  }

  async waitUntilReady(): Promise<void> {
    await this.queue.waitUntilReady();
    await this.events.waitUntilReady();
  }

  /** Enqueue a job, enforcing admission control. */
  async enqueue(data: ExecutionJobData, priority?: number): Promise<{ jobId: string }> {
    const depth = await this.depth();
    if (depth >= env.MAX_QUEUE_DEPTH) {
      log.warn({ depth }, 'queue full — rejecting submission');
      throw new QueueFullError(depth);
    }
    const job = await this.queue.add(EXECUTION_JOB_NAME, data, { priority });
    return { jobId: job.id! };
  }

  /**
   * Enqueue and await the terminal result. Bounded by the compile +
   * execution ceilings plus scheduling headroom, so the HTTP request
   * can never hang indefinitely.
   */
  async enqueueAndWait(
    data: ExecutionJobData,
    priority: number | undefined,
    overallTimeoutMs: number,
  ): Promise<ExecutionResult> {
    const depth = await this.depth();
    if (depth >= env.MAX_QUEUE_DEPTH) {
      throw new QueueFullError(depth);
    }
    const job = await this.queue.add(EXECUTION_JOB_NAME, data, { priority });
    return (await job.waitUntilFinished(this.events, overallTimeoutMs)) as ExecutionResult;
  }

  /** Waiting + active jobs — the live backlog used for admission control. */
  async depth(): Promise<number> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
    return (
      (counts.waiting ?? 0) +
      (counts.active ?? 0) +
      (counts.delayed ?? 0) +
      (counts.prioritized ?? 0)
    );
  }

  async getJobCounts(): Promise<Record<string, number>> {
    return this.queue.getJobCounts();
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.events.close();
  }
}
