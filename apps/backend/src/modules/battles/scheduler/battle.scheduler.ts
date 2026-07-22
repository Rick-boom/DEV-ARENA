import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { BATTLE_CONSTANTS } from '../constants/battle.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IBattleScheduler } from '../interfaces/battle.interfaces.js';

const log = createModuleLogger('battle-scheduler');
const { BULLMQ } = BATTLE_CONSTANTS;

/**
 * Time-driven transitions belong on a durable, distributed timer — not
 * setTimeout, which dies with the process and doesn't survive across
 * nodes. BullMQ delayed jobs give us exactly-once countdown→active,
 * auto-expiry, and ready-check timeouts that fire even if the node that
 * scheduled them has since been replaced.
 */
export class BattleScheduler implements IBattleScheduler {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(BULLMQ.QUEUE, {
      connection,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
    });
  }

  private jobId(kind: string, battleId: string): string {
    return `${kind}:${battleId}`;
  }

  async scheduleStartActive(battleId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      BULLMQ.JOBS.START_ACTIVE,
      { battleId },
      { delay: delayMs, jobId: this.jobId(BULLMQ.JOBS.START_ACTIVE, battleId) },
    );
    log.debug({ battleId, delayMs }, 'scheduled start-active');
  }

  async scheduleExpiry(battleId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      BULLMQ.JOBS.EXPIRE,
      { battleId },
      { delay: delayMs, jobId: this.jobId(BULLMQ.JOBS.EXPIRE, battleId) },
    );
  }

  async scheduleReadyTimeout(battleId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      BULLMQ.JOBS.READY_TIMEOUT,
      { battleId },
      { delay: delayMs, jobId: this.jobId(BULLMQ.JOBS.READY_TIMEOUT, battleId) },
    );
  }

  async cancelAll(battleId: string): Promise<void> {
    await Promise.all(
      Object.values(BULLMQ.JOBS).map((kind) =>
        this.queue.remove(this.jobId(kind, battleId)).catch(() => undefined),
      ),
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
