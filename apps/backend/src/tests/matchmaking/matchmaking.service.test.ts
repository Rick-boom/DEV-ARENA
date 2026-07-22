import { describe, expect, it, beforeEach } from 'vitest';
import { MatchmakingService } from '../../modules/matchmaking/services/matchmaking.service.js';
import {
  AlreadyQueuedError,
  NotQueuedError,
  RateLimitedError,
} from '../../modules/matchmaking/errors/matchmaking-error.js';
import {
  MatchMode,
  Region,
  SkillPreference,
} from '../../modules/matchmaking/types/matchmaking.types.js';
import {
  FakeBattleGateway,
  FakePresenceStore,
  FakePublisher,
  FakeQueueStore,
  FakeRateLimiter,
  FakeUserDirectory,
} from './mm-fakes.js';

describe('MatchmakingService', () => {
  let queue: FakeQueueStore;
  let presence: FakePresenceStore;
  let users: FakeUserDirectory;
  let battles: FakeBattleGateway;
  let publisher: FakePublisher;
  let limiter: FakeRateLimiter;
  let service: MatchmakingService;

  const base = {
    mode: MatchMode.ONE_VS_ONE,
    region: Region.GLOBAL,
    language: 'js',
    skill: SkillPreference.ANY,
  };

  beforeEach(() => {
    queue = new FakeQueueStore();
    presence = new FakePresenceStore();
    users = new FakeUserDirectory();
    battles = new FakeBattleGateway();
    publisher = new FakePublisher();
    limiter = new FakeRateLimiter();
    service = new MatchmakingService(queue, presence, users, battles, publisher, limiter);
  });

  describe('join', () => {
    it('enqueues with the user rating and emits queue:join', async () => {
      users.ratings.set('u1', 1450);
      const { ticket } = await service.join({ userId: 'u1', ...base });
      expect(ticket.rating).toBe(1450);
      expect(await queue.isQueued('u1')).toBe(true);
      expect(publisher.eventsFor('u1', 'queue:join')).toHaveLength(1);
    });

    it('rejects a duplicate queue join', async () => {
      await service.join({ userId: 'u1', ...base });
      await expect(service.join({ userId: 'u1', ...base })).rejects.toBeInstanceOf(
        AlreadyQueuedError,
      );
    });

    it('rate-limits excessive joins', async () => {
      // FakeRateLimiter max defaults to the real config (5). Trip it.
      for (let i = 0; i < 5; i += 1) {
        await service.join({ userId: `spam-${i}`, ...base }).catch(() => undefined);
        await service.leave(`spam-${i}`).catch(() => undefined);
      }
      // 6th hit on the SAME key would exceed; simulate one user hammering
      await service.join({ userId: 'hammer', ...base });
      await service.leave('hammer');
      // Re-join repeatedly to exceed the window for 'hammer'
      let limited = false;
      for (let i = 0; i < 10; i += 1) {
        try {
          await service.join({ userId: 'hammer', ...base });
          await service.leave('hammer');
        } catch (e) {
          if (e instanceof RateLimitedError) limited = true;
        }
      }
      expect(limited).toBe(true);
    });
  });

  describe('leave', () => {
    it('dequeues and emits queue:leave', async () => {
      await service.join({ userId: 'u1', ...base });
      await service.leave('u1');
      expect(await queue.isQueued('u1')).toBe(false);
      expect(publisher.eventsFor('u1', 'queue:leave')).toHaveLength(1);
    });
    it('throws when leaving without a ticket', async () => {
      await expect(service.leave('ghost')).rejects.toBeInstanceOf(NotQueuedError);
    });
  });

  describe('sweep pairing', () => {
    it('matches two close-rated players and creates a battle', async () => {
      users.ratings.set('a', 1500);
      users.ratings.set('b', 1520);
      await service.join({ userId: 'a', ...base });
      await service.join({ userId: 'b', ...base });
      const matched = await service.sweep();
      expect(matched).toBe(1);
      expect(battles.created).toHaveLength(1);
      expect(publisher.eventsFor('a', 'match:found')).toHaveLength(1);
      expect(publisher.eventsFor('b', 'match:found')).toHaveLength(1);
      expect(await queue.isQueued('a')).toBe(false);
    });

    it('does not match players outside the (young) rating window', async () => {
      users.ratings.set('a', 1200);
      users.ratings.set('b', 2000); // 800 apart, fresh tickets
      await service.join({ userId: 'a', ...base });
      await service.join({ userId: 'b', ...base });
      expect(await service.sweep()).toBe(0);
    });

    it('widens the window for a long-waiting ticket', async () => {
      users.ratings.set('a', 1200);
      users.ratings.set('b', 1500); // 300 apart
      await service.join({ userId: 'a', ...base });
      await service.join({ userId: 'b', ...base });
      // Backdate both tickets so the window has grown well past 300.
      for (const id of ['a', 'b']) {
        const t = (await queue.getTicket(id))!;
        t.enqueuedAt = Date.now() - 60_000;
      }
      expect(await service.sweep()).toBe(1);
    });

    it('respects mode/region compatibility', async () => {
      users.ratings.set('a', 1500);
      users.ratings.set('b', 1500);
      await service.join({ userId: 'a', ...base, region: Region.NA });
      await service.join({ userId: 'b', ...base, region: Region.EU });
      expect(await service.sweep()).toBe(0);
    });

    it('queues a reconnect handoff for an offline matched user', async () => {
      users.ratings.set('a', 1500);
      users.ratings.set('b', 1500);
      await service.join({ userId: 'a', ...base });
      await service.join({ userId: 'b', ...base });
      await presence.markOffline('b'); // b dropped after queueing
      await service.sweep();
      const pending = await presence.drainReconnect('b');
      expect(pending).toHaveLength(1);
    });
  });

  describe('reconnect', () => {
    it('flushes pending matches on reconnect', async () => {
      await presence.pushReconnect('u1', { matchId: 'm1' });
      const { pending } = await service.reconnect('u1');
      expect(pending).toHaveLength(1);
      expect(publisher.eventsFor('u1', 'match:found')).toHaveLength(1);
    });
  });
});
