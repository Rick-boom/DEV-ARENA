import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IMatchPublisher } from '../interfaces/matchmaking.interfaces.js';

const log = createModuleLogger('mm-publisher');
const { KEYS } = MM_CONSTANTS;

/**
 * Delivers socket events to users and broadcasts cross-node via Redis
 * Pub/Sub. Direct emits go to the local Socket.IO server (if bound);
 * broadcast() publishes on the `mm:events` channel so a match found on
 * the matcher node reaches a user connected to any OTHER API node. This
 * is the cross-instance glue that lets matchmaking scale horizontally
 * independent of where each user's socket lives.
 */
export class RedisMatchPublisher implements IMatchPublisher {
  constructor(
    private readonly pub: Redis,
    private readonly io?: Server,
  ) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (this.io) this.io.to(`user:${userId}`).emit(event, payload);
  }

  broadcast(event: string, payload: unknown): void {
    void this.pub
      .publish(KEYS.pubsub, JSON.stringify({ event, payload }))
      .catch((err) => log.warn({ err, event }, 'pubsub publish failed'));
  }
}
