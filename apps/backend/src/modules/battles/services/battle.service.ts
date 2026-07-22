import { BattleMode } from '@prisma/client';
import { BATTLE_CONSTANTS } from '../constants/battle.constants.js';
import {
  AlreadyJoinedError,
  BattleFinishedError,
  BattleNotFoundError,
  InvalidInviteError,
  InvalidTransitionError,
  NotHostError,
  ReplayProtectionError,
} from '../errors/battle-error.js';
import { ForbiddenError } from '../../../errors/app-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { canTransition } from '../state/battle-state-machine.js';
import {
  BattleType,
  RuntimeState,
  toPersistedStatus,
  type BattleEvent,
  type RuntimeBattle,
} from '../types/battle.types.js';
import {
  toBattleDto,
  toReplayDto,
  type BattleDto,
  type ReplayDto,
} from '../dto/battle-response.dto.js';
import type {
  BattleActionDto,
  CreateBattleDto,
  FinishBattleDto,
  JoinBattleDto,
} from '../dto/battle-request.dto.js';
import type {
  BattleWithRelations,
  IBattleRepository,
  IBattleScheduler,
  IBattleStateStore,
  IRatingEventPublisher,
  ISocketGateway,
} from '../interfaces/battle.interfaces.js';
import type { RoomService } from './room.service.js';

const log = createModuleLogger('battle-service');
const { TIMING } = BATTLE_CONSTANTS;

interface Actor {
  id: string;
}

/**
 * The Battle Engine core. Owns the full lifecycle and coordinates the
 * durable repository, the ephemeral Redis state, the scheduler, and the
 * outbound socket/rating ports. Design rules enforced here:
 *
 *  • Every lifecycle change goes through the state machine (canTransition)
 *    and the Redis CAS transition, so concurrent or out-of-order actions
 *    can't corrupt a battle.
 *  • Durable status is written only at meaningful boundaries (start,
 *    finish, abort); the second-by-second state lives in Redis.
 *  • Host-only actions (start/pause/resume/cancel) are authorized here.
 *  • Every state change appends to the replay event log and emits the
 *    matching socket event — one code path feeds both live UX and replay.
 */
export class BattleService {
  constructor(
    private readonly repo: IBattleRepository,
    private readonly state: IBattleStateStore,
    private readonly rooms: RoomService,
    private readonly scheduler: IBattleScheduler,
    private readonly sockets: ISocketGateway,
    private readonly rating: IRatingEventPublisher,
  ) {}

  // ── helpers ────────────────────────────────────────────────────
  private async load(battleId: string): Promise<BattleWithRelations> {
    const battle = await this.repo.findById(battleId);
    if (!battle) throw new BattleNotFoundError(battleId);
    return battle;
  }

  private async emitAndLog(
    battle: BattleWithRelations,
    socketEvent: string,
    event: BattleEvent,
  ): Promise<void> {
    await this.state.appendEvent(battle.id, event);
    this.sockets.emitToRoom(battle.roomId, socketEvent, {
      battleId: battle.id,
      ...event,
    });
  }

  private nextSeq(events: BattleEvent[]): number {
    return events.length === 0 ? 1 : events[events.length - 1]!.seq + 1;
  }

  private assertNotReplay = async (
    battleId: string,
    userId: string,
    nonce: number,
  ): Promise<void> => {
    const ok = await this.state.checkAndBumpNonce(battleId, userId, nonce);
    if (!ok) throw new ReplayProtectionError();
  };

  // ── create ─────────────────────────────────────────────────────
  async create(
    dto: CreateBattleDto,
    actor: Actor,
  ): Promise<{ battle: BattleDto; inviteToken: string }> {
    const code = this.rooms.generateCode();
    const problemConnect = dto.problemId ? { connect: { id: dto.problemId } } : undefined;

    // A battle always needs a problem row for the FK; if none supplied,
    // the caller assigns it at start. We defer by requiring problemId at
    // create for rated modes and allowing late assignment otherwise.
    if (!dto.problemId) {
      throw new ForbiddenError('problemId is required to create a battle');
    }

    const created = await this.repo.createRoomWithBattle({
      hostId: actor.id,
      room: {
        code,
        name: dto.name,
        type:
          dto.type === BattleType.COLLABORATION
            ? 'COLLABORATION'
            : dto.type === BattleType.INTERVIEW
              ? 'INTERVIEW'
              : 'BATTLE',
        status: 'WAITING',
        host: { connect: { id: actor.id } },
        maxParticipants: dto.capacity,
        isPrivate: dto.isPrivate || dto.type === BattleType.PRIVATE,
        settings: { battleType: dto.type },
      },
      battle: {
        mode: dto.mode,
        rated: dto.rated && dto.type !== BattleType.PRACTICE,
        status: 'SCHEDULED',
        problem: problemConnect!,
      },
    });

    const runtime: RuntimeBattle = {
      battleId: created.id,
      roomId: created.roomId,
      hostId: actor.id,
      mode: created.mode,
      type: dto.type,
      rated: created.rated,
      state: RuntimeState.WAITING,
      problemId: created.problemId,
      participantIds: [actor.id],
      startedAt: null,
      durationMs: dto.durationMs ?? TIMING.DEFAULT_DURATION_MS,
      pausedAt: null,
      winnerId: null,
      updatedAt: Date.now(),
    };
    await this.state.put(runtime);

    const inviteToken = this.rooms.generateInviteToken();
    await this.state.createInvite(inviteToken, created.id);

    // Ready-check window: auto-cancel a lobby nobody readies up in.
    await this.scheduler.scheduleReadyTimeout(created.id, TIMING.READY_TIMEOUT_MS);

    log.info({ battleId: created.id, type: dto.type, host: actor.id }, 'battle created');
    return { battle: toBattleDto(created, runtime), inviteToken };
  }

  // ── join ───────────────────────────────────────────────────────
  async join(dto: JoinBattleDto, actor: Actor): Promise<BattleDto> {
    let battleId = dto.battleId ?? null;
    if (!battleId && dto.inviteToken) {
      battleId = await this.state.resolveInvite(dto.inviteToken);
      if (!battleId) throw new InvalidInviteError();
    }
    let battle = battleId
      ? await this.repo.findById(battleId)
      : dto.code
        ? await this.repo.findByRoomCode(dto.code)
        : null;
    if (!battle) throw new BattleNotFoundError(dto.battleId ?? dto.code ?? 'invite');

    return this.state.withLock(battle.id, async () => {
      battle = (await this.repo.findById(battle!.id))!;
      if (this.rooms.isParticipant(battle, actor.id)) throw new AlreadyJoinedError();
      this.rooms.assertJoinable(battle);

      await this.repo.addParticipant(battle.id, battle.roomId, actor.id);

      const runtime = await this.state.get(battle.id);
      if (runtime) {
        runtime.participantIds = [...new Set([...runtime.participantIds, actor.id])];
        await this.state.put(runtime);
      }

      const fresh = await this.load(battle.id);
      const events = await this.state.listEvents(battle.id);
      await this.emitAndLog(fresh, 'battle:join', {
        seq: this.nextSeq(events),
        at: Date.now(),
        type: 'PARTICIPANT',
        userId: actor.id,
        note: 'joined',
      });
      log.info({ battleId: battle.id, userId: actor.id }, 'user joined battle');
      return toBattleDto(fresh, runtime);
    });
  }

  // ── ready + start countdown ────────────────────────────────────
  async markReady(battleId: string, actor: Actor): Promise<{ ready: string[]; started: boolean }> {
    const battle = await this.load(battleId);
    if (!this.rooms.isParticipant(battle, actor.id)) throw new ForbiddenError('Not a participant');
    const ready = await this.state.setReady(battleId, actor.id);
    const active = battle.room.participants.filter((p) => p.leftAt === null).map((p) => p.userId);
    const everyoneReady = active.length >= 2 && active.every((u) => ready.includes(u));

    if (everyoneReady) {
      // Auto-start is system-initiated on behalf of the host.
      await this.startCountdown(battleId, { id: battle.room.hostId });
      return { ready, started: true };
    }
    return { ready, started: false };
  }

  /** Host (or auto, once everyone is ready) moves WAITING → COUNTDOWN. */
  async startCountdown(battleId: string, actor: Actor): Promise<BattleDto> {
    const battle = await this.load(battleId);
    if (!this.rooms.isHost(battle, actor.id)) throw new NotHostError();

    const runtime = await this.guardedTransition(
      battleId,
      RuntimeState.WAITING,
      RuntimeState.COUNTDOWN,
      (r) => ({
        ...r,
        state: RuntimeState.COUNTDOWN,
      }),
    );

    const events = await this.state.listEvents(battleId);
    await this.emitAndLog(battle, 'countdown', {
      seq: this.nextSeq(events),
      at: Date.now(),
      type: 'STATE',
      state: RuntimeState.COUNTDOWN,
      note: `${TIMING.COUNTDOWN_SECONDS}s`,
    });
    // Durable timer fires the COUNTDOWN → ACTIVE transition.
    await this.scheduler.scheduleStartActive(battleId, TIMING.COUNTDOWN_SECONDS * 1000);
    return toBattleDto(battle, runtime);
  }

  /** Called by the scheduler worker: COUNTDOWN → ACTIVE. */
  async activate(battleId: string): Promise<void> {
    const battle = await this.load(battleId);
    const startedAt = Date.now();
    const runtime = await this.guardedTransition(
      battleId,
      RuntimeState.COUNTDOWN,
      RuntimeState.ACTIVE,
      (r) => ({
        ...r,
        state: RuntimeState.ACTIVE,
        startedAt,
      }),
    );
    await this.repo.markStarted(battleId, new Date(startedAt));

    const events = await this.state.listEvents(battleId);
    await this.emitAndLog(battle, 'battle:start', {
      seq: this.nextSeq(events),
      at: startedAt,
      type: 'STATE',
      state: RuntimeState.ACTIVE,
      note: runtime.problemId ?? undefined,
    });
    // Auto-finish timer.
    await this.scheduler.scheduleExpiry(battleId, runtime.durationMs);
    log.info({ battleId }, 'battle active');
  }

  // ── pause / resume ─────────────────────────────────────────────
  async pause(dto: BattleActionDto, actor: Actor): Promise<BattleDto> {
    await this.assertNotReplay(dto.battleId, actor.id, dto.nonce);
    const battle = await this.load(dto.battleId);
    if (!this.rooms.isHost(battle, actor.id)) throw new NotHostError();

    const runtime = await this.guardedTransition(
      dto.battleId,
      RuntimeState.ACTIVE,
      RuntimeState.PAUSED,
      (r) => ({
        ...r,
        state: RuntimeState.PAUSED,
        pausedAt: Date.now(),
      }),
    );
    const events = await this.state.listEvents(dto.battleId);
    await this.emitAndLog(battle, 'battle:pause', {
      seq: this.nextSeq(events),
      at: Date.now(),
      type: 'STATE',
      state: RuntimeState.PAUSED,
    });
    return toBattleDto(battle, runtime);
  }

  async resume(dto: BattleActionDto, actor: Actor): Promise<BattleDto> {
    await this.assertNotReplay(dto.battleId, actor.id, dto.nonce);
    const battle = await this.load(dto.battleId);
    if (!this.rooms.isHost(battle, actor.id)) throw new NotHostError();

    const runtime = await this.guardedTransition(
      dto.battleId,
      RuntimeState.PAUSED,
      RuntimeState.ACTIVE,
      (r) => {
        // Extend the deadline by however long we were paused (fair play).
        const pausedMs = r.pausedAt ? Date.now() - r.pausedAt : 0;
        return {
          ...r,
          state: RuntimeState.ACTIVE,
          pausedAt: null,
          durationMs: r.durationMs + pausedMs,
        };
      },
    );
    const events = await this.state.listEvents(dto.battleId);
    await this.emitAndLog(battle, 'battle:resume', {
      seq: this.nextSeq(events),
      at: Date.now(),
      type: 'STATE',
      state: RuntimeState.ACTIVE,
    });
    return toBattleDto(battle, runtime);
  }

  // ── finish ─────────────────────────────────────────────────────
  async finish(dto: FinishBattleDto, actor: Actor): Promise<BattleDto> {
    await this.assertNotReplay(dto.battleId, actor.id, dto.nonce);
    return this.state.withLock(dto.battleId, async () => {
      const battle = await this.load(dto.battleId);
      if (battle.status === 'FINISHED') throw new BattleFinishedError();
      if (!this.rooms.isHost(battle, actor.id)) throw new NotHostError();
      const runtime = await this.state.get(dto.battleId);
      if (!runtime) throw new BattleNotFoundError(dto.battleId);
      if (runtime.state !== RuntimeState.ACTIVE && runtime.state !== RuntimeState.PAUSED) {
        throw new InvalidTransitionError(runtime.state, RuntimeState.FINISHED);
      }
      const winnerId = dto.winnerId ?? runtime.winnerId ?? null;
      return this.finalize(battle, runtime, winnerId, 'host_finish');
    });
  }

  /** Shared finalize path used by finish, expiry, and winner-detection. */
  private async finalize(
    battle: BattleWithRelations,
    runtime: RuntimeBattle,
    winnerId: string | null,
    reason: string,
  ): Promise<BattleDto> {
    const ranks = this.computeRanks(battle, winnerId);
    await this.repo.finish({ battleId: battle.id, winnerId, endedAt: new Date(), ranks });
    await this.scheduler.cancelAll(battle.id);

    const events = await this.state.listEvents(battle.id);
    await this.emitAndLog(battle, 'winner', {
      seq: this.nextSeq(events),
      at: Date.now(),
      type: 'STATE',
      state: RuntimeState.FINISHED,
      userId: winnerId ?? undefined,
      note: reason,
    });
    this.sockets.emitToRoom(battle.roomId, 'battle:end', { battleId: battle.id, winnerId });

    await this.rating.publishBattleResult({
      battleId: battle.id,
      winnerId,
      participantIds: runtime.participantIds,
      rated: runtime.rated,
    });

    // Runtime state is now historical; drop the ephemeral record.
    await this.state.delete(battle.id);
    const fresh = await this.load(battle.id);
    log.info({ battleId: battle.id, winnerId, reason }, 'battle finished');
    return toBattleDto(fresh, { ...runtime, state: RuntimeState.FINISHED, winnerId });
  }

  private computeRanks(
    battle: BattleWithRelations,
    winnerId: string | null,
  ): { userId: string; rank: number; score: number }[] {
    return battle.participants
      .map((p) => ({
        userId: p.userId,
        rank: p.userId === winnerId ? 1 : 2,
        score: p.userId === winnerId ? 100 : p.score,
      }))
      .sort((a, b) => a.rank - b.rank);
  }

  /** Scheduler worker path: auto-finish / expire. */
  async expire(battleId: string): Promise<void> {
    const runtime = await this.state.get(battleId);
    if (!runtime) return; // already finished/cleaned
    const battle = await this.load(battleId);
    if (runtime.state === RuntimeState.WAITING || runtime.state === RuntimeState.COUNTDOWN) {
      await this.cancelInternal(battle, runtime, RuntimeState.EXPIRED, 'expired_in_lobby');
      return;
    }
    await this.finalize(battle, runtime, runtime.winnerId, 'time_expired');
  }

  /** Scheduler worker path: ready-check timed out. */
  async readyTimeout(battleId: string): Promise<void> {
    const runtime = await this.state.get(battleId);
    if (!runtime || runtime.state !== RuntimeState.WAITING) return;
    const battle = await this.load(battleId);
    await this.cancelInternal(battle, runtime, RuntimeState.CANCELLED, 'ready_timeout');
  }

  // ── cancel / leave ─────────────────────────────────────────────
  async cancel(battleId: string, actor: Actor): Promise<BattleDto> {
    const battle = await this.load(battleId);
    if (!this.rooms.isHost(battle, actor.id)) throw new NotHostError();
    const runtime = await this.state.get(battleId);
    if (!runtime) throw new BattleNotFoundError(battleId);
    if (runtime.state !== RuntimeState.WAITING && runtime.state !== RuntimeState.COUNTDOWN) {
      throw new InvalidTransitionError(runtime.state, RuntimeState.CANCELLED);
    }
    return this.cancelInternal(battle, runtime, RuntimeState.CANCELLED, 'host_cancel');
  }

  private async cancelInternal(
    battle: BattleWithRelations,
    runtime: RuntimeBattle,
    to: typeof RuntimeState.CANCELLED | typeof RuntimeState.EXPIRED,
    reason: string,
  ): Promise<BattleDto> {
    await this.repo.abort(battle.id);
    await this.scheduler.cancelAll(battle.id);
    const events = await this.state.listEvents(battle.id);
    await this.emitAndLog(battle, 'battle:end', {
      seq: this.nextSeq(events),
      at: Date.now(),
      type: 'STATE',
      state: to,
      note: reason,
    });
    await this.state.delete(battle.id);
    const fresh = await this.load(battle.id);
    return toBattleDto(fresh, { ...runtime, state: to });
  }

  async leave(battleId: string, actor: Actor): Promise<void> {
    const battle = await this.load(battleId);
    if (!this.rooms.isParticipant(battle, actor.id)) return;
    await this.repo.removeParticipant(battle.roomId, actor.id);
    const events = await this.state.listEvents(battleId);
    await this.emitAndLog(battle, 'battle:leave', {
      seq: this.nextSeq(events),
      at: Date.now(),
      type: 'PARTICIPANT',
      userId: actor.id,
      note: 'left',
    });

    // Host left an in-flight lobby → transfer ownership or cancel.
    if (this.rooms.isHost(battle, actor.id)) {
      const next = this.rooms.nextOwner(battle, actor.id);
      const runtime = await this.state.get(battleId);
      if (next) {
        this.sockets.emitToRoom(battle.roomId, 'battle:update', {
          battleId,
          ownerId: next,
          note: 'ownership_transferred',
        });
      } else if (runtime) {
        await this.cancelInternal(battle, runtime, RuntimeState.CANCELLED, 'host_left_empty');
      }
    }
  }

  // ── rematch ────────────────────────────────────────────────────
  async rematch(
    battleId: string,
    actor: Actor,
  ): Promise<{ battle: BattleDto; inviteToken: string }> {
    const previous = await this.load(battleId);
    if (previous.status !== 'FINISHED' && previous.status !== 'ABORTED') {
      throw new InvalidTransitionError(previous.status, 'REMATCH');
    }
    // A rematch is a brand-new battle reusing the same problem + mode.
    return this.create(
      {
        type:
          (previous.room.settings as { battleType?: BattleType })?.battleType ??
          BattleType.ONE_VS_ONE,
        mode: previous.mode as BattleMode,
        problemId: previous.problemId,
        rated: previous.rated,
        isPrivate: previous.room.isPrivate,
        name: `${previous.room.name} (rematch)`,
        capacity: previous.room.maxParticipants,
      },
      actor,
    );
  }

  // ── reads ──────────────────────────────────────────────────────
  async getById(battleId: string): Promise<BattleDto> {
    const battle = await this.load(battleId);
    const runtime = await this.state.get(battleId);
    return toBattleDto(battle, runtime);
  }

  async history(userId: string, page: number, pageSize: number) {
    const { rows, total } = await this.repo.listHistoryForUser(userId, page, pageSize);
    return {
      items: rows.map((b) => toBattleDto(b, null)),
      page,
      pageSize,
      total,
    };
  }

  async replay(battleId: string): Promise<ReplayDto> {
    await this.load(battleId); // 404 if unknown
    const events = await this.state.listEvents(battleId);
    return toReplayDto(battleId, events);
  }

  // ── submission tracking (called by the judge adapter) ──────────
  async recordSubmission(verdict: {
    battleId: string;
    userId: string;
    submissionId: string;
    status: string;
    passed: number;
    total: number;
    runtimeMs?: number;
    language?: string;
    isFinal?: boolean;
  }): Promise<void> {
    const runtime = await this.state.get(verdict.battleId);
    if (!runtime || runtime.state !== RuntimeState.ACTIVE) return; // ignore stray verdicts
    const battle = await this.load(verdict.battleId);

    const events = await this.state.listEvents(verdict.battleId);
    await this.emitAndLog(battle, 'submission:update', {
      seq: this.nextSeq(events),
      at: Date.now(),
      type: 'SUBMISSION',
      userId: verdict.userId,
      submission: {
        submissionId: verdict.submissionId,
        event: this.mapVerdict(verdict.status, verdict.isFinal),
        language: verdict.language,
        passed: verdict.passed,
        total: verdict.total,
        runtimeMs: verdict.runtimeMs,
      },
    });

    // First ACCEPTED wins a 1v1 (Codeforces-style "first to solve").
    if (
      verdict.status === 'ACCEPTED' &&
      runtime.mode === BattleMode.ONE_VS_ONE &&
      !runtime.winnerId
    ) {
      await this.state.withLock(verdict.battleId, async () => {
        const latest = await this.state.get(verdict.battleId);
        if (!latest || latest.winnerId) return;
        latest.winnerId = verdict.userId;
        await this.state.put(latest);
        await this.finalize(battle, latest, verdict.userId, 'first_accepted');
      });
    }
  }

  private mapVerdict(status: string, isFinal?: boolean) {
    if (isFinal) return 'FINAL_SUBMISSION' as const;
    switch (status) {
      case 'ACCEPTED':
        return 'ACCEPTED' as const;
      case 'WRONG_ANSWER':
        return 'WRONG_ANSWER' as const;
      case 'TIME_LIMIT_EXCEEDED':
        return 'TIME_LIMIT_EXCEEDED' as const;
      case 'MEMORY_LIMIT_EXCEEDED':
        return 'MEMORY_LIMIT_EXCEEDED' as const;
      case 'RUNTIME_ERROR':
        return 'RUNTIME_ERROR' as const;
      case 'COMPILATION_ERROR':
        return 'COMPILATION_ERROR' as const;
      default:
        return 'FIRST_COMPILE' as const;
    }
  }

  // ── transition helper ──────────────────────────────────────────
  private async guardedTransition(
    battleId: string,
    from: RuntimeState,
    to: RuntimeState,
    mutate: (r: RuntimeBattle) => RuntimeBattle,
  ): Promise<RuntimeBattle> {
    if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
    return this.state.transition(battleId, from, (current) => {
      const next = mutate(current);
      // keep persisted-status projection available to callers if needed
      void toPersistedStatus(next.state);
      return next;
    });
  }
}
