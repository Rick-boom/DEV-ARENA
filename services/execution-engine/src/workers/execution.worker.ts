import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { createModuleLogger } from '../utils/logger.js';
import { EXECUTION_JOB_NAME } from '../queue/execution.queue.js';
import type { DeadLetterQueue } from '../queue/dead-letter.queue.js';
import type { ExecutionService } from '../services/execution.service.js';
import type { ExecutionJobData, ExecutionResult } from '../types/execution.types.js';

const log = createModuleLogger('execution-worker');

/**
 * Consumer side. Each worker process runs `concurrency` jobs in
 * parallel; scale throughput by running more worker containers (the
 * service is designed for 100k+ submissions/day, which is horizontal
 * fan-out over this exact worker). On terminal failure the job is
 * copied to the DLQ. The processor NEVER throws for a normal bad
 * verdict — a runtime error in user code is a successful job with a
 * RUNTIME_ERROR result; it only throws for infrastructure faults,
 * which is what triggers BullMQ retries.
 */
export function createExecutionWorker(
  connection: Redis,
  service: ExecutionService,
  deadLetters: DeadLetterQueue,
): Worker<ExecutionJobData, ExecutionResult> {
  const worker = new Worker<ExecutionJobData, ExecutionResult>(
    env.EXECUTION_QUEUE_NAME,
    async (job: Job<ExecutionJobData, ExecutionResult>) => {
      const started = Date.now();
      log.info({ jobId: job.id, language: job.data.language }, 'job started');
      const result = await service.execute(job.data);
      log.info({ jobId: job.id, status: result.status, ms: Date.now() - started }, 'job finished');
      return result;
    },
    { connection, concurrency: env.WORKER_CONCURRENCY, name: EXECUTION_JOB_NAME },
  );

  worker.on('ready', () => {
    log.info(
      { queue: env.EXECUTION_QUEUE_NAME, concurrency: env.WORKER_CONCURRENCY },
      'worker ready',
    );
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, 'job failed');
    // Only dead-letter once retries are truly exhausted.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void deadLetters.add(job.id ?? 'unknown', job.data, err.message);
    }
  });

  return worker;
}
