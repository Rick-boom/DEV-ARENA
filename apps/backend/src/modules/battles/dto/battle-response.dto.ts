import type { BattleWithRelations } from '../interfaces/battle.interfaces.js';
import type { BattleEvent, RuntimeBattle } from '../types/battle.types.js';

/**
 * Response DTOs + mappers — the doorway from DB/runtime records to the
 * wire. Runtime (Redis) state is merged over the durable record so the
 * client always sees the live lifecycle state, not the coarse enum.
 */
export interface BattleDto {
  id: string;
  roomId: string;
  roomCode: string;
  hostId: string;
  mode: string;
  status: string; // durable status
  runtimeState: string | null; // live state if the battle is in flight
  rated: boolean;
  problemId: string | null;
  participants: { userId: string; score: number; rank: number | null }[];
  startedAt: string | null;
  endedAt: string | null;
  winnerId: string | null;
  createdAt: string;
}

export function toBattleDto(battle: BattleWithRelations, runtime: RuntimeBattle | null): BattleDto {
  return {
    id: battle.id,
    roomId: battle.roomId,
    roomCode: battle.room.code,
    hostId: battle.room.hostId,
    mode: battle.mode,
    status: battle.status,
    runtimeState: runtime?.state ?? null,
    rated: battle.rated,
    problemId: runtime?.problemId ?? battle.problemId,
    participants: battle.participants.map((p) => ({
      userId: p.userId,
      score: p.score,
      rank: p.rank,
    })),
    startedAt: battle.startedAt?.toISOString() ?? null,
    endedAt: battle.endedAt?.toISOString() ?? null,
    winnerId: battle.winnerId,
    createdAt: battle.createdAt.toISOString(),
  };
}

export interface ReplayDto {
  battleId: string;
  events: BattleEvent[];
  totalEvents: number;
}

export function toReplayDto(battleId: string, events: BattleEvent[]): ReplayDto {
  return { battleId, events, totalEvents: events.length };
}
