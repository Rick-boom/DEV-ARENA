import type { BattleMode, BattleStatus } from '@prisma/client';

/**
 * Battle Engine domain types.
 *
 * SCHEMA STRATEGY (why no migration): the persisted `BattleStatus`
 * enum (SCHEDULED, IN_PROGRESS, FINISHED, ABORTED) is the DURABLE
 * record. The fine-grained lifecycle the product needs — Waiting,
 * Countdown, Active, Paused, Finished, Cancelled, Expired — is
 * EPHEMERAL coordination state that changes by the second and must be
 * shared across socket nodes. That belongs in Redis, not in a column
 * we'd migrate constantly. We keep the runtime state machine here and
 * project it onto the existing enum at every persistence boundary.
 */
export const RuntimeState = {
  WAITING: 'WAITING',
  COUNTDOWN: 'COUNTDOWN',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type RuntimeState = (typeof RuntimeState)[keyof typeof RuntimeState];

/**
 * Product-level battle "type". Also not a new column: it is composed
 * from existing fields — Battle.mode, Battle.rated, Room.type,
 * Room.isPrivate — so the taxonomy is derived, never stored twice.
 */
export const BattleType = {
  ONE_VS_ONE: 'ONE_VS_ONE',
  PRACTICE: 'PRACTICE',
  INTERVIEW: 'INTERVIEW',
  COLLABORATION: 'COLLABORATION',
  PRIVATE: 'PRIVATE',
  TOURNAMENT: 'TOURNAMENT',
} as const;
export type BattleType = (typeof BattleType)[keyof typeof BattleType];

/** Projection: runtime state → the durable enum we persist. */
export function toPersistedStatus(state: RuntimeState): BattleStatus {
  switch (state) {
    case RuntimeState.WAITING:
    case RuntimeState.COUNTDOWN:
      return 'SCHEDULED';
    case RuntimeState.ACTIVE:
    case RuntimeState.PAUSED:
      return 'IN_PROGRESS';
    case RuntimeState.FINISHED:
      return 'FINISHED';
    case RuntimeState.CANCELLED:
    case RuntimeState.EXPIRED:
      return 'ABORTED';
    default:
      return 'ABORTED';
  }
}

/** Ephemeral runtime record kept in Redis for the duration of a battle. */
export interface RuntimeBattle {
  battleId: string;
  roomId: string;
  hostId: string;
  mode: BattleMode;
  type: BattleType;
  rated: boolean;
  state: RuntimeState;
  problemId: string | null;
  participantIds: string[];
  /** epoch ms; set when Active begins, drives the client clock + expiry */
  startedAt: number | null;
  durationMs: number;
  /** epoch ms of the pause, so resume can extend the deadline fairly */
  pausedAt: number | null;
  winnerId: string | null;
  updatedAt: number;
}

/** Submission event categories the engine tracks + replays. */
export const SubmissionEvent = {
  FIRST_COMPILE: 'FIRST_COMPILE',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  WRONG_ANSWER: 'WRONG_ANSWER',
  ACCEPTED: 'ACCEPTED',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  FINAL_SUBMISSION: 'FINAL_SUBMISSION',
} as const;
export type SubmissionEvent = (typeof SubmissionEvent)[keyof typeof SubmissionEvent];

/** One entry in the replay timeline (also broadcast live as submission:update). */
export interface BattleEvent {
  seq: number;
  at: number; // epoch ms
  type: 'STATE' | 'SUBMISSION' | 'PARTICIPANT';
  userId?: string;
  state?: RuntimeState;
  submission?: {
    submissionId: string;
    event: SubmissionEvent;
    language?: string;
    passed?: number;
    total?: number;
    runtimeMs?: number;
  };
  note?: string;
}
