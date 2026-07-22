/**
 * Central tuning for the AI Coach. One place to change models, token
 * ceilings, cache TTLs, and the Redis keyspace. Cost control lives here:
 * caching aggressively + capping tokens is how a 1M-request/month
 * service stays affordable.
 */
export const AI_CONSTANTS = {
  MODEL: {
    // Flash is cheap + fast — right for high-volume coaching. Pro is
    // reserved for the occasional deep review if ever needed.
    DEFAULT: 'gemini-1.5-flash',
    REVIEW: 'gemini-1.5-flash',
    TEMPERATURE: 0.4, // low → grounded, less hallucination
    TOP_P: 0.9,
  },
  LIMITS: {
    MAX_PROMPT_CHARS: 24_000, // hard ceiling → PromptTooLarge
    MAX_CODE_CHARS: 12_000,
    MAX_OUTPUT_TOKENS: 800, // cap response length (cost + focus)
    MAX_HINTS_PER_PROBLEM: 5, // escalating hint ladder
  },
  CACHE: {
    RESPONSE_TTL_SECONDS: 24 * 3600, // identical (mode+context) → cached answer
    PROMPT_TTL_SECONDS: 6 * 3600,
    HISTORY_MAX: 100, // per-user interaction log length
    HISTORY_TTL_SECONDS: 30 * 24 * 3600,
  },
  RATE_LIMIT: {
    WINDOW_MS: 60_000,
    MAX_PER_MINUTE: 20, // per user
  },
  SUPPORTED_LANGUAGES: ['javascript', 'typescript', 'python', 'cpp', 'java'] as const,
  KEYS: {
    response: (hash: string) => `ai:resp:${hash}`,
    prompt: (hash: string) => `ai:prompt:${hash}`,
    history: (userId: string) => `ai:history:${userId}`,
    rate: (userId: string) => `ai:rate:${userId}`,
    hintLevel: (userId: string, problemId: string) => `ai:hintlvl:${userId}:${problemId}`,
    metrics: 'ai:metrics',
  },
  BULLMQ: { QUEUE: 'ai-coach' },
} as const;

export type SupportedLanguage = (typeof AI_CONSTANTS.SUPPORTED_LANGUAGES)[number];
