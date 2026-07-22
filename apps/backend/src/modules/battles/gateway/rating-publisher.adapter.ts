import { createModuleLogger } from '../../../lib/logger.js';
import type { IRatingEventPublisher } from '../interfaces/battle.interfaces.js';

const log = createModuleLogger('rating-publisher');

/**
 * Emits the "battle finished" domain event for the (assumed) rating
 * service to consume and apply Elo. The Battle Engine deliberately does
 * NOT compute ratings — it only announces the result and lets the
 * rating service own that math (single responsibility). Here we publish
 * onto a BullMQ queue the rating service would drain; injected so tests
 * assert the handoff without a live queue.
 */
export interface IQueuePublisher {
  add(jobName: string, data: unknown): Promise<void>;
}

export class RatingEventPublisher implements IRatingEventPublisher {
  constructor(private readonly queue: IQueuePublisher) {}

  async publishBattleResult(payload: {
    battleId: string;
    winnerId: string | null;
    participantIds: string[];
    rated: boolean;
  }): Promise<void> {
    if (!payload.rated) {
      log.debug({ battleId: payload.battleId }, 'unrated battle — no rating event');
      return;
    }
    await this.queue.add('battle:rating-update', payload);
    log.info({ battleId: payload.battleId, winnerId: payload.winnerId }, 'rating event published');
  }
}
