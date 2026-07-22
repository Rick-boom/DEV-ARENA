import type { Server } from 'socket.io';
import { createModuleLogger } from '../../../lib/logger.js';
import type { ISocketGateway } from '../interfaces/battle.interfaces.js';

const log = createModuleLogger('battle-socket-emitter');

/**
 * Adapter that fulfils the ISocketGateway port using the (assumed,
 * already-built) Socket.IO server. The engine calls emitToRoom /
 * emitToUser; this maps battle rooms onto Socket.IO room names. If the
 * io instance isn't provided (e.g. running the REST API without the
 * socket process co-located), it degrades to logging — the battle
 * still progresses; only live push is skipped.
 */
export class SocketEmitterAdapter implements ISocketGateway {
  constructor(private readonly io?: Server) {}

  emitToRoom(roomId: string, event: string, payload: unknown): void {
    if (!this.io) {
      log.debug({ roomId, event }, 'socket emit skipped (no io bound)');
      return;
    }
    this.io.to(`battle:${roomId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, payload);
  }
}
