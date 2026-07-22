import type { Redis } from 'ioredis';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IEventPublisher } from '../interfaces/judge.interfaces.js';
import type { JudgeEvent } from '../types/judge.types.js';

const log = createModuleLogger('judge-event-publisher');

/**
 * Publishes judge lifecycle events on a Redis pub/sub channel. The
 * Battle Engine (and socket fan-out) subscribe to `submission.verdict`
 * to update battle scoreboards the instant a submission is judged. Fire-
 * and-forget: a publish failure is logged, never blocks judging.
 */
export class RedisEventPublisher implements IEventPublisher {
  constructor(
    private readonly pub: Redis,
    private readonly channel = 'judge:events',
  ) {}

  async publish(event: JudgeEvent, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.pub.publish(this.channel, JSON.stringify({ event, payload, at: Date.now() }));
    } catch (err) {
      log.warn({ err, event }, 'event publish failed');
    }
  }
}

/**
 * Direct in-process publisher that forwards verdicts into the Battle
 * Engine's judge adapter (battleModule.judge.handle). Used when the
 * judge and battle engine run in the same process; the Redis publisher
 * is for cross-service delivery.
 */
export class BattleBridgePublisher implements IEventPublisher {
  constructor(
    private readonly onVerdict: (payload: Record<string, unknown>) => Promise<void> | void,
    private readonly delegate?: IEventPublisher,
  ) {}

  async publish(event: JudgeEvent, payload: Record<string, unknown>): Promise<void> {
    await this.delegate?.publish(event, payload);
    if (event === 'submission.verdict' && payload.battleId) {
      await this.onVerdict(payload);
    }
  }
}
