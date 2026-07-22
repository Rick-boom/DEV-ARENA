import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { JUDGE_CONSTANTS } from '../constants/judge.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { JudgeEvent, type SubmissionJob } from '../types/judge.types.js';
import type { IEventPublisher, ISubmissionRepository } from '../interfaces/judge.interfaces.js';
import type { JudgeService } from '../services/judge.service.js';

const log = createModuleLogger('judge-worker');
const { QUEUE } = JUDGE_CONSTANTS;

/**
 * The judge worker. Pulls submissions off the queue and judges them.
 * Concurrency is the horizontal-scale knob: run N workers × C
 * concurrency across machines and the throughput scales linearly, since
 * all coordination lives in Redis. A job that exhausts its retries is
 * dead-lettered AND the submission is marked INTERNAL_ERROR, so a user
 * never sees a submission stuck in RUNNING forever.
 */
export function createJudgeWorker(
  connection: Redis,
  judge: JudgeService,
  submissions: ISubmissionRepository,
  publisher: IEventPublisher,
  concurrency = 5,
): { worker: Worker<SubmissionJob>; dlq: Queue; close: () => Promise<void> } {
  const dlq = new Queue(QUEUE.DLQ, { connection });

  const worker = new Worker<SubmissionJob>(
    QUEUE.NAME,
    async (job: Job<SubmissionJob>) => {
      // Expired jobs are abandoned rather than judged against stale state.
      if (Date.now() - job.timestamp > QUEUE.JOB_TTL_MS) {
        log.warn({ submissionId: job.data.submissionId }, 'job expired — abandoning');
        await submissions.markStatus(job.data.submissionId, 'INTERNAL_ERROR');
        return;
      }
      await judge.judge(job.data);
    },
    { connection, concurrency },
  );

  worker.on('failed', (job, err) => {
    log.error(
      { submissionId: job?.data.submissionId, attempts: job?.attemptsMade, err: err.message },
      'judge job failed',
    );
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // Terminal failure: dead-letter it and stop the submission from
      // hanging in RUNNING forever.
      void dlq.add('dead', {
        submissionId: job.data.submissionId,
        reason: err.message,
        at: Date.now(),
      });
      void submissions.markStatus(job.data.submissionId, 'INTERNAL_ERROR').catch(() => undefined);
      void publisher.publish(JudgeEvent.FAILED, {
        submissionId: job.data.submissionId,
        reason: err.message,
      });
    }
  });

  return {
    worker,
    dlq,
    close: async () => {
      await worker.close();
      await dlq.close();
    },
  };
}
