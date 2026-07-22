import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { createModuleLogger } from '../utils/logger.js';
import type { ExecutionJobData } from '../types/execution.types.js';

const log = createModuleLogger('dead-letter-queue');

/**
 * Dead Letter Queue. When a job exhausts all retry attempts it is
 * copied here with its failure context so nothing is silently lost: an
 * operator can inspect, replay, or alert on the DLQ. Kept as a plain
 * Queue (no worker) — it is a durable inbox, not a processor.
 */
export class DeadLetterQueue {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(env.DEAD_LETTER_QUEUE_NAME, {
      connection,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });
  }

  async add(originalJobId: string, data: ExecutionJobData, reason: string): Promise<void> {
    await this.queue.add('dead-letter', {
      originalJobId,
      data,
      reason,
      deadLetteredAt: Date.now(),
    });
    log.warn({ originalJobId, reason }, 'job moved to dead-letter queue');
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
