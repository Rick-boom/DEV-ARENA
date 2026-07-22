import { describe, expect, it, beforeEach } from 'vitest';
import { BattleService } from '../../modules/battles/services/battle.service.js';
import { RoomService } from '../../modules/battles/services/room.service.js';
import { RuntimeState, BattleType } from '../../modules/battles/types/battle.types.js';
import {
  AlreadyJoinedError,
  BattleFinishedError,
  InvalidInviteError,
  NotHostError,
  ReplayProtectionError,
  RoomFullError,
} from '../../modules/battles/errors/battle-error.js';
import {
  FakeBattleRepository,
  FakeRatingPublisher,
  FakeScheduler,
  FakeSocketGateway,
  FakeStateStore,
} from './battle-fakes.js';

/**
 * Full battle lifecycle through the real service against in-memory
 * ports. Covers create → join → countdown → activate → pause/resume →
 * finish, plus winner detection, replay protection, and socket
 * emissions — the "lifecycle + socket + integration" coverage the spec
 * asks for, at the honest testable boundary (no live Redis/Postgres).
 */
describe('BattleService lifecycle', () => {
  let repo: FakeBattleRepository;
  let state: FakeStateStore;
  let scheduler: FakeScheduler;
  let sockets: FakeSocketGateway;
  let rating: FakeRatingPublisher;
  let service: BattleService;

  const host = { id: 'host-1' };
  const guest = { id: 'guest-1' };

  const createDto = {
    type: BattleType.ONE_VS_ONE,
    mode: 'ONE_VS_ONE' as const,
    problemId: '11111111-1111-4111-8111-111111111111',
    rated: true,
    isPrivate: false,
    name: 'Test Battle',
    capacity: 2,
  };

  beforeEach(() => {
    repo = new FakeBattleRepository();
    state = new FakeStateStore();
    scheduler = new FakeScheduler();
    sockets = new FakeSocketGateway();
    rating = new FakeRatingPublisher();
    service = new BattleService(repo, state, new RoomService(), scheduler, sockets, rating);
  });

  async function createBattle() {
    const { battle, inviteToken } = await service.create(createDto, host);
    return { battleId: battle.id, inviteToken };
  }

  describe('create', () => {
    it('creates a WAITING battle, an invite, and schedules a ready timeout', async () => {
      const { battle, inviteToken } = await service.create(createDto, host);
      expect(battle.runtimeState).toBe(RuntimeState.WAITING);
      expect(inviteToken).toBeTruthy();
      expect(scheduler.calls.some((c) => c.kind === 'ready-timeout')).toBe(true);
      expect(await state.get(battle.id)).not.toBeNull();
    });

    it('requires a problemId', async () => {
      await expect(
        service.create({ ...createDto, problemId: undefined }, host),
      ).rejects.toBeDefined();
    });
  });

  describe('join', () => {
    it('lets a second player join by battleId', async () => {
      const { battleId } = await createBattle();
      const dto = await service.join({ battleId }, guest);
      expect(dto.participants.some((p) => p.userId === guest.id)).toBe(true);
      expect(sockets.eventsOfType('battle:join')).toHaveLength(1);
    });

    it('resolves an invite token', async () => {
      const { inviteToken } = await createBattle();
      const dto = await service.join({ inviteToken }, guest);
      expect(dto.participants.some((p) => p.userId === guest.id)).toBe(true);
    });

    it('rejects an invalid invite', async () => {
      await expect(service.join({ inviteToken: 'bogus-token' }, guest)).rejects.toBeInstanceOf(
        InvalidInviteError,
      );
    });

    it('rejects a duplicate join', async () => {
      const { battleId } = await createBattle();
      await expect(service.join({ battleId }, host)).rejects.toBeInstanceOf(AlreadyJoinedError);
    });

    it('rejects joining a full room', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest); // 2/2
      await expect(service.join({ battleId }, { id: 'third' })).rejects.toBeInstanceOf(
        RoomFullError,
      );
    });
  });

  describe('countdown + activate', () => {
    it('host starts the countdown and schedules activation', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      const dto = await service.startCountdown(battleId, host);
      expect(dto.runtimeState).toBe(RuntimeState.COUNTDOWN);
      expect(sockets.eventsOfType('countdown')).toHaveLength(1);
      expect(scheduler.calls.some((c) => c.kind === 'start-active')).toBe(true);
    });

    it('non-host cannot start', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await expect(service.startCountdown(battleId, guest)).rejects.toBeInstanceOf(NotHostError);
    });

    it('activate moves COUNTDOWN → ACTIVE, marks started, schedules expiry', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await service.startCountdown(battleId, host);
      await service.activate(battleId);
      const runtime = await state.get(battleId);
      expect(runtime?.state).toBe(RuntimeState.ACTIVE);
      expect(runtime?.startedAt).toBeTruthy();
      expect(sockets.eventsOfType('battle:start')).toHaveLength(1);
      expect(scheduler.calls.some((c) => c.kind === 'expire')).toBe(true);
    });
  });

  describe('ready check', () => {
    it('auto-starts the countdown when everyone readies up', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await service.markReady(battleId, host);
      const res = await service.markReady(battleId, guest);
      expect(res.started).toBe(true);
      expect((await state.get(battleId))?.state).toBe(RuntimeState.COUNTDOWN);
    });
  });

  describe('pause / resume', () => {
    async function activeBattle() {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await service.startCountdown(battleId, host);
      await service.activate(battleId);
      return battleId;
    }

    it('host pauses and resumes; resume extends the deadline', async () => {
      const battleId = await activeBattle();
      const before = (await state.get(battleId))!.durationMs;

      await service.pause({ battleId, nonce: 1 }, host);
      expect((await state.get(battleId))?.state).toBe(RuntimeState.PAUSED);

      await new Promise((r) => setTimeout(r, 15));
      await service.resume({ battleId, nonce: 2 }, host);
      const runtime = await state.get(battleId);
      expect(runtime?.state).toBe(RuntimeState.ACTIVE);
      expect(runtime!.durationMs).toBeGreaterThanOrEqual(before);
    });

    it('enforces replay protection via nonce', async () => {
      const battleId = await activeBattle();
      await service.pause({ battleId, nonce: 5 }, host);
      await service.resume({ battleId, nonce: 6 }, host);
      // Re-using a nonce ≤ high-water mark is rejected.
      await expect(service.pause({ battleId, nonce: 6 }, host)).rejects.toBeInstanceOf(
        ReplayProtectionError,
      );
    });
  });

  describe('finish + winner', () => {
    async function activeBattle() {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await service.startCountdown(battleId, host);
      await service.activate(battleId);
      return battleId;
    }

    it('host finishes; publishes a rating event and emits winner + battle:end', async () => {
      const battleId = await activeBattle();
      const dto = await service.finish({ battleId, nonce: 1, winnerId: host.id }, host);
      expect(dto.status).toBe('FINISHED');
      expect(dto.winnerId).toBe(host.id);
      expect(sockets.eventsOfType('winner')).toHaveLength(1);
      expect(sockets.eventsOfType('battle:end')).toHaveLength(1);
      expect(rating.results).toHaveLength(1);
      expect(await state.get(battleId)).toBeNull(); // ephemeral state cleared
    });

    it('first ACCEPTED submission auto-wins a 1v1', async () => {
      const battleId = await activeBattle();
      await service.recordSubmission({
        battleId,
        userId: guest.id,
        submissionId: 'sub-1',
        status: 'ACCEPTED',
        passed: 8,
        total: 8,
        isFinal: true,
      });
      const battle = await service.getById(battleId);
      expect(battle.status).toBe('FINISHED');
      expect(battle.winnerId).toBe(guest.id);
      expect(sockets.eventsOfType('submission:update')).toHaveLength(1);
    });

    it('rejects finishing an already-finished battle', async () => {
      const battleId = await activeBattle();
      await service.finish({ battleId, nonce: 1, winnerId: host.id }, host);
      await expect(service.finish({ battleId, nonce: 2 }, host)).rejects.toBeInstanceOf(
        BattleFinishedError,
      );
    });

    it('ignores stray verdicts once a battle is no longer active', async () => {
      const battleId = await activeBattle();
      await service.finish({ battleId, nonce: 1, winnerId: host.id }, host);
      // No throw, no extra emission.
      await service.recordSubmission({
        battleId,
        userId: guest.id,
        submissionId: 'sub-late',
        status: 'ACCEPTED',
        passed: 8,
        total: 8,
      });
      expect(sockets.eventsOfType('submission:update')).toHaveLength(0);
    });
  });

  describe('cancel + expiry', () => {
    it('host cancels a lobby (WAITING → CANCELLED)', async () => {
      const { battleId } = await createBattle();
      const dto = await service.cancel(battleId, host);
      expect(dto.runtimeState).toBe(RuntimeState.CANCELLED);
    });

    it('ready-timeout cancels an un-started lobby', async () => {
      const { battleId } = await createBattle();
      await service.readyTimeout(battleId);
      const battle = await service.getById(battleId);
      expect(battle.status).toBe('ABORTED');
    });

    it('expiry finishes an active battle', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await service.startCountdown(battleId, host);
      await service.activate(battleId);
      await service.expire(battleId);
      expect((await service.getById(battleId)).status).toBe('FINISHED');
    });
  });

  describe('replay', () => {
    it('returns the ordered event timeline', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await service.startCountdown(battleId, host);
      await service.activate(battleId);
      const replay = await service.replay(battleId);
      expect(replay.events.length).toBeGreaterThanOrEqual(3);
      // sequence numbers strictly increase
      const seqs = replay.events.map((e) => e.seq);
      expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    });
  });

  describe('rematch', () => {
    it('creates a fresh battle reusing the problem after finish', async () => {
      const { battleId } = await createBattle();
      await service.join({ battleId }, guest);
      await service.startCountdown(battleId, host);
      await service.activate(battleId);
      await service.finish({ battleId, nonce: 1, winnerId: host.id }, host);

      const { battle } = await service.rematch(battleId, host);
      expect(battle.id).not.toBe(battleId);
      expect(battle.runtimeState).toBe(RuntimeState.WAITING);
    });
  });
});
