import type { BattleMode } from '@prisma/client';
import type {
  BattleWithRelations,
  IBattleRepository,
  IBattleScheduler,
  IBattleStateStore,
  IRatingEventPublisher,
  ISocketGateway,
} from '../../modules/battles/interfaces/battle.interfaces.js';
import type { IQueuePublisher } from '../../modules/battles/gateway/rating-publisher.adapter.js';
import type { RuntimeState } from '../../modules/battles/types/battle.types.js';
import { type BattleEvent, type RuntimeBattle } from '../../modules/battles/types/battle.types.js';
import { InvalidTransitionError } from '../../modules/battles/errors/battle-error.js';

/**
 * In-memory fakes for every Battle Engine port. Because the service
 * depends on interfaces, the ENTIRE lifecycle is testable without
 * Postgres, Redis, BullMQ, or Socket.IO.
 */

const now = new Date('2026-01-01T00:00:00Z');

export function makeBattle(overrides: Partial<BattleWithRelations> = {}): BattleWithRelations {
  const hostId = overrides.room?.hostId ?? 'host-1';
  return {
    id: 'battle-1',
    roomId: 'room-1',
    problemId: 'problem-1',
    mode: 'ONE_VS_ONE' as BattleMode,
    status: 'SCHEDULED',
    rated: true,
    startedAt: null,
    endedAt: null,
    winnerId: null,
    createdAt: now,
    updatedAt: now,
    room: {
      id: 'room-1',
      code: 'ABC123',
      name: 'Test',
      type: 'BATTLE',
      status: 'WAITING',
      hostId,
      maxParticipants: 2,
      isPrivate: false,
      settings: {},
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      participants: [{ id: 'rp-1', roomId: 'room-1', userId: hostId, joinedAt: now, leftAt: null }],
    },
    participants: [
      {
        id: 'bp-1',
        battleId: 'battle-1',
        userId: hostId,
        score: 0,
        rank: null,
        ratingBefore: null,
        ratingAfter: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
}

export class FakeBattleRepository implements IBattleRepository {
  battles = new Map<string, BattleWithRelations>();
  ratingEvents: unknown[] = [];

  async createRoomWithBattle(input: {
    hostId: string;
    room: { name?: string; code?: string; maxParticipants?: number };
  }): Promise<BattleWithRelations> {
    const id = `battle-${this.battles.size + 1}`;
    const b = makeBattle({
      id,
      roomId: `room-${this.battles.size + 1}`,
      room: {
        ...makeBattle().room,
        id: `room-${this.battles.size + 1}`,
        hostId: input.hostId,
        code: input.room.code ?? 'ABC123',
        name: input.room.name ?? 'Test',
        maxParticipants: input.room.maxParticipants ?? 2,
        participants: [
          {
            id: 'rp-1',
            roomId: `room-${this.battles.size + 1}`,
            userId: input.hostId,
            joinedAt: now,
            leftAt: null,
          },
        ],
      },
      participants: [
        {
          id: 'bp-1',
          battleId: id,
          userId: input.hostId,
          score: 0,
          rank: null,
          ratingBefore: null,
          ratingAfter: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    this.battles.set(id, b);
    return b;
  }
  async findById(id: string) {
    return this.battles.get(id) ?? null;
  }
  async findByRoomCode(code: string) {
    return [...this.battles.values()].find((b) => b.room.code === code) ?? null;
  }
  async addParticipant(battleId: string, roomId: string, userId: string) {
    const b = this.battles.get(battleId);
    if (!b) return;
    if (!b.participants.some((p) => p.userId === userId)) {
      b.participants.push({
        id: `bp-${b.participants.length + 1}`,
        battleId,
        userId,
        score: 0,
        rank: null,
        ratingBefore: null,
        ratingAfter: null,
        createdAt: now,
        updatedAt: now,
      });
      b.room.participants.push({
        id: `rp-${b.room.participants.length + 1}`,
        roomId,
        userId,
        joinedAt: now,
        leftAt: null,
      });
    }
  }
  async removeParticipant(roomId: string, userId: string) {
    for (const b of this.battles.values()) {
      const p = b.room.participants.find((x) => x.userId === userId && x.leftAt === null);
      if (p) p.leftAt = now;
    }
  }
  async markStarted(battleId: string, startedAt: Date) {
    const b = this.battles.get(battleId);
    if (b) {
      b.status = 'IN_PROGRESS';
      b.startedAt = startedAt;
    }
  }
  async finish(input: { battleId: string; winnerId: string | null; endedAt: Date }) {
    const b = this.battles.get(input.battleId);
    if (b) {
      b.status = 'FINISHED';
      b.winnerId = input.winnerId;
      b.endedAt = input.endedAt;
      b.room.status = 'COMPLETED';
    }
  }
  async abort(battleId: string) {
    const b = this.battles.get(battleId);
    if (b) {
      b.status = 'ABORTED';
      b.room.status = 'CANCELLED';
    }
  }
  async listHistoryForUser(userId: string, page: number, pageSize: number) {
    const rows = [...this.battles.values()].filter(
      (b) =>
        b.participants.some((p) => p.userId === userId) &&
        ['FINISHED', 'ABORTED'].includes(b.status),
    );
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
  }
  async recordRatingEvents(events: unknown[]) {
    this.ratingEvents.push(...events);
  }
}

export class FakeStateStore implements IBattleStateStore {
  states = new Map<string, RuntimeBattle>();
  ready = new Map<string, Set<string>>();
  invites = new Map<string, string>();
  events = new Map<string, BattleEvent[]>();
  nonces = new Map<string, number>();

  async put(state: RuntimeBattle) {
    this.states.set(state.battleId, { ...state });
  }
  async get(battleId: string) {
    const s = this.states.get(battleId);
    return s ? { ...s } : null;
  }
  async transition(
    battleId: string,
    expected: RuntimeState,
    mutate: (c: RuntimeBattle) => RuntimeBattle,
  ) {
    const current = this.states.get(battleId);
    if (!current) throw new InvalidTransitionError('MISSING', 'ANY');
    if (current.state !== expected)
      throw new InvalidTransitionError(current.state, `expected ${expected}`);
    const next = mutate({ ...current });
    this.states.set(battleId, next);
    return next;
  }
  async delete(battleId: string) {
    this.states.delete(battleId);
    this.ready.delete(battleId);
    this.events.delete(battleId);
  }
  async setReady(battleId: string, userId: string) {
    if (!this.ready.has(battleId)) this.ready.set(battleId, new Set());
    this.ready.get(battleId)!.add(userId);
    return [...this.ready.get(battleId)!];
  }
  async getReady(battleId: string) {
    return [...(this.ready.get(battleId) ?? [])];
  }
  async createInvite(token: string, battleId: string) {
    this.invites.set(token, battleId);
  }
  async resolveInvite(token: string) {
    return this.invites.get(token) ?? null;
  }
  async appendEvent(battleId: string, event: BattleEvent) {
    if (!this.events.has(battleId)) this.events.set(battleId, []);
    this.events.get(battleId)!.push(event);
  }
  async listEvents(battleId: string) {
    return [...(this.events.get(battleId) ?? [])];
  }
  async checkAndBumpNonce(battleId: string, userId: string, nonce: number) {
    const key = `${battleId}:${userId}`;
    const current = this.nonces.get(key) ?? 0;
    if (!Number.isFinite(nonce) || nonce <= current) return false;
    this.nonces.set(key, nonce);
    return true;
  }
  async withLock<T>(_battleId: string, fn: () => Promise<T>) {
    return fn();
  }
}

export class FakeScheduler implements IBattleScheduler {
  calls: { kind: string; battleId: string; delayMs?: number }[] = [];
  async scheduleStartActive(battleId: string, delayMs: number) {
    this.calls.push({ kind: 'start-active', battleId, delayMs });
  }
  async scheduleExpiry(battleId: string, delayMs: number) {
    this.calls.push({ kind: 'expire', battleId, delayMs });
  }
  async scheduleReadyTimeout(battleId: string, delayMs: number) {
    this.calls.push({ kind: 'ready-timeout', battleId, delayMs });
  }
  async cancelAll(battleId: string) {
    this.calls.push({ kind: 'cancel-all', battleId });
  }
}

export class FakeSocketGateway implements ISocketGateway {
  emitted: { target: string; event: string; payload: unknown }[] = [];
  emitToRoom(roomId: string, event: string, payload: unknown) {
    this.emitted.push({ target: `room:${roomId}`, event, payload });
  }
  emitToUser(userId: string, event: string, payload: unknown) {
    this.emitted.push({ target: `user:${userId}`, event, payload });
  }
  eventsOfType(event: string) {
    return this.emitted.filter((e) => e.event === event);
  }
}

export class FakeQueuePublisher implements IQueuePublisher {
  jobs: { jobName: string; data: unknown }[] = [];
  async add(jobName: string, data: unknown) {
    this.jobs.push({ jobName, data });
  }
}

export class FakeRatingPublisher implements IRatingEventPublisher {
  results: unknown[] = [];
  async publishBattleResult(payload: unknown) {
    this.results.push(payload);
  }
}
