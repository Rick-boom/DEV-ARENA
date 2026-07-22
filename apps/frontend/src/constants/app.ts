/** Product-level constants and client-side policy knobs. */
export const APP = {
  NAME: 'DevArena',
  TAGLINE: 'Competitive programming, head to head.',
} as const;

export const SESSION = {
  /** Refresh this many ms before the access token actually expires. */
  REFRESH_SKEW_MS: 60_000,
  /** Log out after this much inactivity (Remember me extends it). */
  IDLE_TIMEOUT_MS: 30 * 60_000,
  IDLE_TIMEOUT_REMEMBERED_MS: 7 * 24 * 60 * 60_000,
  /** How often the idle watcher checks. */
  IDLE_POLL_MS: 30_000,
} as const;

export const STORAGE_KEYS = {
  THEME: 'devarena:theme',
  REMEMBER_ME: 'devarena:remember-me',
  LAST_ACTIVE: 'devarena:last-active',
  RETURN_TO: 'devarena:return-to',
} as const;

export const NOTIFICATION_DEFAULT_DURATION_MS = 5_000;

export const RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 400,
  /** Only idempotent verbs are safe to replay automatically. */
  RETRYABLE_METHODS: ['get', 'head', 'options'] as readonly string[],
  RETRYABLE_STATUSES: [408, 429, 500, 502, 503, 504] as readonly number[],
} as const;
