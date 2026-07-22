import { randomBytes } from 'node:crypto';
import { BATTLE_CONSTANTS } from '../constants/battle.constants.js';
import { RoomClosedError, RoomFullError } from '../errors/battle-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { BattleWithRelations } from '../interfaces/battle.interfaces.js';

const log = createModuleLogger('room-service');
const { ROOM } = BATTLE_CONSTANTS;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

/**
 * Room concerns for battles: code generation, capacity + lock checks,
 * and ownership rules. Kept separate from BattleService so the
 * architecture's Battle → Room layering is explicit and each has one
 * responsibility. Room membership is persisted (durable) by the repo;
 * this service holds the RULES about rooms.
 */
export class RoomService {
  /** Cryptographically-random, human-shareable room code. */
  generateCode(): string {
    const bytes = randomBytes(ROOM.CODE_LENGTH);
    let code = '';
    for (let i = 0; i < ROOM.CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    }
    return code;
  }

  generateInviteToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /** A room accepts joins only while WAITING and below capacity. */
  assertJoinable(battle: BattleWithRelations): void {
    if (battle.room.status !== 'WAITING') {
      throw new RoomClosedError();
    }
    const active = battle.room.participants.filter((p) => p.leftAt === null).length;
    if (active >= battle.room.maxParticipants) {
      throw new RoomFullError(battle.room.maxParticipants);
    }
  }

  isHost(battle: BattleWithRelations, userId: string): boolean {
    return battle.room.hostId === userId;
  }

  isParticipant(battle: BattleWithRelations, userId: string): boolean {
    return battle.participants.some((p) => p.userId === userId);
  }

  /** Earliest-joined remaining member inherits the room if the host leaves. */
  nextOwner(battle: BattleWithRelations, leavingUserId: string): string | null {
    const remaining = battle.room.participants
      .filter((p) => p.leftAt === null && p.userId !== leavingUserId)
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const next = remaining[0]?.userId ?? null;
    if (next) log.debug({ roomId: battle.roomId, next }, 'ownership will transfer');
    return next;
  }
}
