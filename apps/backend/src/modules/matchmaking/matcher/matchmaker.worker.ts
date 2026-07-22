import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { MatchmakingService } from '../services/matchmaking.service.js';

const log = createModuleLogger('matchmaker-worker');
const { BULLMQ, QUEUE } = MM_CONSTANTS;

/**
 * The matching loop as a BullMQ repeatable job. A durable, single-owner
 * sweep (BullMQ guarantees one active runner per job id across the
 * cluster) is the right home for periodic pairing: it survives node
 * restarts and never double-runs, unlike a per-process setInterval that
 * would multiply the sweep by the number of API nodes.
 *
 * Retry + DLQ: a sweep that throws is retried with backoff; repeated
 * failures land in a dead-letter queue for inspection rather than
 * silently stalling matchmaking.
 */
export function createMatchmakerWorker(
  connection: Redis,
  service: MatchmakingService,
): {
  worker: Worker;
  queue: Queue;
  start: () => Promise<void>;
} {
  const queue = new Queue(BULLMQ.QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: true,
      removeOnFail: 500,
    },
  });
  const dlq = new Queue(BULLMQ.DLQ, { connection });

  const worker = new Worker(
    BULLMQ.QUEUE,
    async (job: Job) => {
      if (job.name !== BULLMQ.JOBS.SWEEP) return;
      const matched = await service.sweep();
      if (matched > 0) log.debug({ matched }, 'sweep matched pairs');
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, 'sweep failed');
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void dlq.add('dead', { at: Date.now(), reason: err.message });
    }
  });

  const start = async (): Promise<void> => {
    // A single repeatable sweep drives the whole matcher.
    await queue.add(BULLMQ.JOBS.SWEEP, {}, { repeat: { every: QUEUE.TICK_MS }, jobId: 'mm-sweep' });
    log.info({ everyMs: QUEUE.TICK_MS }, 'matchmaker sweep scheduled');
  };

  return { worker, queue, start };
}
