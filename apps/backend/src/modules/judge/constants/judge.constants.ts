/**
 * Central tuning for the Judge. One place to change concurrency, output
 * ceilings, retry policy, and the Redis/BullMQ namespace. These knobs
 * are what let one Judge fleet process 500k submissions/day predictably.
 */
export const JUDGE_CONSTANTS = {
  EXECUTION: {
    // How many test cases of ONE submission run in parallel against the
    // Execution Engine. Bounded so a single big-testcount submission
    // can't monopolise the engine's capacity.
    TESTCASE_CONCURRENCY: 4,
    OUTPUT_LIMIT_BYTES: 256 * 1024, // stdout ceiling → OUTPUT_LIMIT_EXCEEDED
    COMPILE_TIMEOUT_MS: 10_000,
  },
  COMPARE: {
    FLOAT_EPSILON: 1e-6, // abs/rel tolerance for floating-point checks
  },
  QUEUE: {
    NAME: 'judge-submissions',
    DLQ: 'judge-submissions-dlq',
    ATTEMPTS: 3, // retries before dead-letter
    BACKOFF_MS: 2_000,
    JOB_TTL_MS: 5 * 60_000, // a job older than this is abandoned
    // Priority: contest/battle submissions jump ahead of practice.
    PRIORITY: { BATTLE: 1, CONTEST: 1, PRACTICE: 5 },
  },
  RATE_LIMIT: {
    WINDOW_MS: 60_000,
    MAX_PER_MINUTE: 20, // per user
    DUPLICATE_WINDOW_MS: 10_000, // identical code re-submit guard
  },
  KEYS: {
    rate: (userId: string) => `judge:rate:${userId}`,
    dedupe: (userId: string, problemId: string, hash: string) =>
      `judge:dedupe:${userId}:${problemId}:${hash}`,
    timeline: (submissionId: string) => `judge:timeline:${submissionId}`,
  },
} as const;
