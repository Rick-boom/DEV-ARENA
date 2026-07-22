import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { BATTLE_CONSTANTS } from '../constants/battle.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { BattleService } from '../services/battle.service.js';

const log = createModuleLogger('battle-scheduler-worker');
const { BULLMQ } = BATTLE_CONSTANTS;

/**
 * Drains the battle-scheduler queue and applies time-driven
 * transitions. Runs in the backend process (or a dedicated worker
 * process for scale). Because the jobs are durable BullMQ delayed jobs,
 * a countdown or expiry fires even if the node that scheduled it was
 * replaced — the correctness guarantee setTimeout can't give.
 */
export function createBattleSchedulerWorker(connection: Redis, service: BattleService): Worker {
  const worker = new Worker(
    BULLMQ.QUEUE,
    async (job: Job<{ battleId: string }>) => {
      const { battleId } = job.data;
      switch (job.name) {
        case BULLMQ.JOBS.START_ACTIVE:
          await service.activate(battleId);
          break;
        case BULLMQ.JOBS.EXPIRE:
          await service.expire(battleId);
          break;
        case BULLMQ.JOBS.READY_TIMEOUT:
          await service.readyTimeout(battleId);
          break;
        default:
          log.warn({ job: job.name }, 'unknown scheduler job');
      }
    },
    { connection },
  );
  worker.on('failed', (job, err) =>
    log.error({ jobId: job?.id, err: err.message }, 'scheduler job failed'),
  );
  return worker;
}
