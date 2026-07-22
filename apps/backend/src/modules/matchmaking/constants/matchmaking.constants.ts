/**
 * Central tuning + Redis key namespace for matchmaking + leaderboards.
 * Every Redis structure this service uses is named here so the whole
 * keyspace is greppable and evictable.
 */
export const MM_CONSTANTS = {
  RATING: {
    DEFAULT: 1200,
    // K-factor by experience: volatile while provisional, stable at the top.
    K_PROVISIONAL: 40, // < 30 games
    K_STANDARD: 20,
    K_ELITE: 10, // rating >= 2400
    PROVISIONAL_GAMES: 30,
    ELITE_THRESHOLD: 2400,
    FLOOR: 100,
  },
  QUEUE: {
    // Rating window starts tight and widens with wait time so a match is
    // both fair early and guaranteed eventually.
    BASE_WINDOW: 50,
    WINDOW_GROWTH_PER_SEC: 15,
    MAX_WINDOW: 600,
    TIMEOUT_SECONDS: 120, // ticket TTL → QueueTimeout
    TICK_MS: 1000, // matcher sweep interval
  },
  RATE_LIMIT: {
    JOIN_WINDOW_MS: 10_000,
    JOIN_MAX: 5,
  },
  LEADERBOARD: {
    PAGE_MAX: 100,
    SNAPSHOT_TOP_N: 1000, // how many rows we persist per snapshot
  },
  STREAMS: {
    MAXLEN: 100_000, // cap the rating event stream
  },
  KEYS: {
    // ZSET: matchmaking pool, score = rating
    queuePool: (mode: string, region: string) => `mm:pool:${mode}:${region}`,
    // HASH: the full ticket payload for a queued user
    ticket: (userId: string) => `mm:ticket:${userId}`,
    // SET: duplicate-queue protection + fast membership
    queuedSet: 'mm:queued',
    // SET: online presence
    online: 'mm:online',
    // ZSET: leaderboard board per scope/group/period
    board: (scope: string, group: string, period: string) => `lb:${scope}:${group}:${period}`,
    // HASH: per-user live rating + streak stats
    ratingStats: (userId: string) => `rating:${userId}`,
    // STREAM: append-only rating-change event log (multi-consumer)
    ratingStream: 'rating:events',
    // LIST: per-user reconnect queue (pending match handoff)
    reconnect: (userId: string) => `mm:reconnect:${userId}`,
    // Pub/Sub channel for cross-node match/leaderboard notifications
    pubsub: 'mm:events',
    // rate-limit bucket
    joinRate: (userId: string) => `mm:joinrate:${userId}`,
  },
  BULLMQ: {
    QUEUE: 'matchmaking',
    JOBS: { SWEEP: 'mm:sweep' },
    DLQ: 'matchmaking-dlq',
  },
} as const;
