import type { Battle, BattleParticipant, Prisma, Room, RoomParticipant } from '@prisma/client';
import type { BattleEvent, RuntimeBattle, RuntimeState } from '../types/battle.types.js';

/**
 * Ports. The Battle Engine OWNS the battle lifecycle but DEPENDS on
 * external services it does not implement (judge, socket gateway,
 * rating). Depending on these interfaces — not concrete services —
 * is what keeps the engine testable and lets the real infra be wired
 * in at the composition root (Dependency Inversion).
 */

// ── persistence ────────────────────────────────────────────────────
export interface IBattleRepository {
  createRoomWithBattle(input: {
    room: Prisma.RoomCreateInput;
    battle: Omit<Prisma.BattleCreateInput, 'room'>;
    hostId: string;
  }): Promise<BattleWithRelations>;
  findById(battleId: string): Promise<BattleWithRelations | null>;
  findByRoomCode(code: string): Promise<BattleWithRelations | null>;
  addParticipant(battleId: string, roomId: string, userId: string): Promise<void>;
  removeParticipant(roomId: string, userId: string): Promise<void>;
  markStarted(battleId: string, startedAt: Date): Promise<void>;
  finish(input: {
    battleId: string;
    winnerId: string | null;
    endedAt: Date;
    ranks: { userId: string; rank: number; score: number }[];
  }): Promise<void>;
  abort(battleId: string): Promise<void>;
  listHistoryForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ rows: BattleWithRelations[]; total: number }>;
  recordRatingEvents(events: Prisma.RatingHistoryCreateManyInput[]): Promise<void>;
}

export type BattleWithRelations = Battle & {
  room: Room & { participants: RoomParticipant[] };
  participants: BattleParticipant[];
};

// ── ephemeral runtime state (Redis) ────────────────────────────────
export interface IBattleStateStore {
  put(state: RuntimeBattle): Promise<void>;
  get(battleId: string): Promise<RuntimeBattle | null>;
  /** Atomic compare-and-set on the state field to avoid lost updates. */
  transition(
    battleId: string,
    expected: RuntimeState,
    mutate: (current: RuntimeBattle) => RuntimeBattle,
  ): Promise<RuntimeBattle>;
  delete(battleId: string): Promise<void>;

  setReady(battleId: string, userId: string): Promise<string[]>;
  getReady(battleId: string): Promise<string[]>;

  createInvite(token: string, battleId: string): Promise<void>;
  resolveInvite(token: string): Promise<string | null>;

  appendEvent(battleId: string, event: BattleEvent): Promise<void>;
  listEvents(battleId: string): Promise<BattleEvent[]>;

  /** monotonic per-user nonce for replay protection on state actions */
  checkAndBumpNonce(battleId: string, userId: string, nonce: number): Promise<boolean>;

  withLock<T>(battleId: string, fn: () => Promise<T>): Promise<T>;
}

// ── outbound ports (assumed services) ──────────────────────────────
export interface ISocketGateway {
  emitToRoom(roomId: string, event: string, payload: unknown): void;
  emitToUser(userId: string, event: string, payload: unknown): void;
}

export interface IJudgePort {
  /** Fired when a submission verdict arrives from the judge service. */
  onVerdict(handler: (verdict: JudgeVerdict) => void): void;
}

export interface JudgeVerdict {
  battleId: string;
  userId: string;
  submissionId: string;
  status: string; // SubmissionStatus
  passed: number;
  total: number;
  runtimeMs?: number;
  language?: string;
  isFinal?: boolean;
}

export interface IRatingEventPublisher {
  /** Battle-finished → hand off to the (assumed) rating service. */
  publishBattleResult(payload: {
    battleId: string;
    winnerId: string | null;
    participantIds: string[];
    rated: boolean;
  }): Promise<void>;
}

export interface IBattleScheduler {
  scheduleStartActive(battleId: string, delayMs: number): Promise<void>;
  scheduleExpiry(battleId: string, delayMs: number): Promise<void>;
  scheduleReadyTimeout(battleId: string, delayMs: number): Promise<void>;
  cancelAll(battleId: string): Promise<void>;
}
