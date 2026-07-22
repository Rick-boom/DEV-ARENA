import type { Redis } from 'ioredis';
import { BATTLE_CONSTANTS } from '../constants/battle.constants.js';
import { InvalidTransitionError, ReplayProtectionError } from '../errors/battle-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IBattleStateStore } from '../interfaces/battle.interfaces.js';
import type { BattleEvent, RuntimeBattle, RuntimeState } from '../types/battle.types.js';

const log = createModuleLogger('battle-state-store');
const { REDIS_KEYS, TIMING } = BATTLE_CONSTANTS;

/**
 * Ephemeral battle state in Redis. This is the fast, shared source of
 * truth for a live battle: every socket node reads/writes the same
 * record, so pause/resume/finish issued on any node are consistent.
 *
 * Two concurrency safeguards:
 *  • transition() is an optimistic compare-and-set on the state field
 *    inside a WATCH/MULTI, so two racing "start" clicks can't both win.
 *  • withLock() is a short SET NX lease for multi-key critical sections
 *    (e.g. finish, which touches state + event log + scheduler).
 * Every key carries a TTL so a crashed node can never leak battle state.
 */
export class RedisBattleStateStore implements IBattleStateStore {
  constructor(private readonly redis: Redis) {}

  async put(state: RuntimeBattle): Promise<void> {
    const key = REDIS_KEYS.runtimeState(state.battleId);
    await this.redis.set(
      key,
      JSON.stringify({ ...state, updatedAt: Date.now() }),
      'EX',
      TIMING.RUNTIME_STATE_TTL_SECONDS,
    );
  }

  async get(battleId: string): Promise<RuntimeBattle | null> {
    const raw = await this.redis.get(REDIS_KEYS.runtimeState(battleId));
    return raw ? (JSON.parse(raw) as RuntimeBattle) : null;
  }

  async transition(
    battleId: string,
    expected: RuntimeState,
    mutate: (current: RuntimeBattle) => RuntimeBattle,
  ): Promise<RuntimeBattle> {
    const key = REDIS_KEYS.runtimeState(battleId);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.redis.watch(key);
      const raw = await this.redis.get(key);
      if (!raw) {
        await this.redis.unwatch();
        throw new InvalidTransitionError('MISSING', 'ANY');
      }
      const current = JSON.parse(raw) as RuntimeBattle;
      if (current.state !== expected) {
        await this.redis.unwatch();
        throw new InvalidTransitionError(current.state, `expected ${expected}`);
      }
      const next = { ...mutate(current), updatedAt: Date.now() };
      const result = await this.redis
        .multi()
        .set(key, JSON.stringify(next), 'EX', TIMING.RUNTIME_STATE_TTL_SECONDS)
        .exec();
      // exec() returns null when the WATCH tripped → retry.
      if (result) return next;
      log.debug({ battleId, attempt }, 'transition CAS retry');
    }
    throw new InvalidTransitionError(expected, 'contended');
  }

  async delete(battleId: string): Promise<void> {
    await this.redis.del(
      REDIS_KEYS.runtimeState(battleId),
      REDIS_KEYS.ready(battleId),
      REDIS_KEYS.eventLog(battleId),
    );
  }

  async setReady(battleId: string, userId: string): Promise<string[]> {
    const key = REDIS_KEYS.ready(battleId);
    await this.redis.sadd(key, userId);
    await this.redis.expire(key, TIMING.RUNTIME_STATE_TTL_SECONDS);
    return this.redis.smembers(key);
  }

  async getReady(battleId: string): Promise<string[]> {
    return this.redis.smembers(REDIS_KEYS.ready(battleId));
  }

  async createInvite(token: string, battleId: string): Promise<void> {
    await this.redis.set(REDIS_KEYS.invite(token), battleId, 'EX', TIMING.INVITE_TTL_SECONDS);
  }

  async resolveInvite(token: string): Promise<string | null> {
    return this.redis.get(REDIS_KEYS.invite(token));
  }

  async appendEvent(battleId: string, event: BattleEvent): Promise<void> {
    const key = REDIS_KEYS.eventLog(battleId);
    await this.redis.rpush(key, JSON.stringify(event));
    await this.redis.expire(key, TIMING.RUNTIME_STATE_TTL_SECONDS);
  }

  async listEvents(battleId: string): Promise<BattleEvent[]> {
    const raw = await this.redis.lrange(REDIS_KEYS.eventLog(battleId), 0, -1);
    return raw.map((r) => JSON.parse(r) as BattleEvent);
  }

  async checkAndBumpNonce(battleId: string, userId: string, nonce: number): Promise<boolean> {
    const key = REDIS_KEYS.nonce(battleId, userId);
    const current = Number((await this.redis.get(key)) ?? 0);
    if (!Number.isFinite(nonce) || nonce <= current) return false;
    await this.redis.set(key, String(nonce), 'EX', TIMING.RUNTIME_STATE_TTL_SECONDS);
    return true;
  }

  async withLock<T>(battleId: string, fn: () => Promise<T>): Promise<T> {
    const key = REDIS_KEYS.lock(battleId);
    const token = `${Date.now()}-${Math.random()}`;
    // 5s lease; long enough for a critical section, short enough to
    // self-heal if the holder dies.
    for (let i = 0; i < 50; i += 1) {
      const ok = await this.redis.set(key, token, 'PX', 5000, 'NX');
      if (ok) break;
      await new Promise((r) => setTimeout(r, 100));
      if (i === 49) throw new ReplayProtectionError();
    }
    try {
      return await fn();
    } finally {
      // Release only if we still hold the lease (compare-and-delete).
      const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
      await this.redis.eval(lua, 1, key, token).catch(() => undefined);
    }
  }
}
