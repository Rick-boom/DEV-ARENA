/**
 * Central tuning + key namespace for the Battle Engine. One place to
 * change timings; no magic numbers in the state logic.
 */
export const BATTLE_CONSTANTS = {
  ROOM: {
    DEFAULT_CAPACITY: 2,
    CODE_LENGTH: 6, // human-shareable invite code (A–Z0–9)
    MAX_CAPACITY: 16, // free-for-all / tournament seat ceiling
  },
  TIMING: {
    COUNTDOWN_SECONDS: 5, // Countdown → Active
    READY_TIMEOUT_MS: 60_000, // lobby auto-cancel if not everyone readies
    DEFAULT_DURATION_MS: 30 * 60_000, // Active → auto-finish (30 min)
    INVITE_TTL_SECONDS: 3600, // invite link validity
    RUNTIME_STATE_TTL_SECONDS: 6 * 3600, // Redis ephemeral-state safety TTL
  },
  RATE_LIMIT: {
    JOIN_WINDOW_MS: 10_000,
    JOIN_MAX: 10,
  },
  CACHE: {
    HISTORY_TTL_SECONDS: 30,
  },
  REDIS_KEYS: {
    runtimeState: (battleId: string) => `battle:${battleId}:state`,
    ready: (battleId: string) => `battle:${battleId}:ready`,
    invite: (token: string) => `battle:invite:${token}`,
    eventLog: (battleId: string) => `battle:${battleId}:events`,
    lock: (battleId: string) => `battle:${battleId}:lock`,
    joinRate: (userId: string) => `battle:joinrate:${userId}`,
    nonce: (battleId: string, userId: string) => `battle:${battleId}:nonce:${userId}`,
  },
  BULLMQ: {
    QUEUE: 'battle-scheduler',
    JOBS: {
      START_ACTIVE: 'battle:start-active',
      EXPIRE: 'battle:expire',
      READY_TIMEOUT: 'battle:ready-timeout',
    },
  },
} as const;
