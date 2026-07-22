/**
 * Every route path in one place. Components import from here instead of
 * hard-coding strings, so a path change is a single edit and typos
 * become compile errors.
 */
export const ROUTES = {
  HOME: '/',

  // public / auth
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  OAUTH_CALLBACK: '/auth/callback',

  // protected
  DASHBOARD: '/dashboard',
  PROBLEMS: '/problems',
  PROBLEM: (slug: string) => `/problems/${slug}`,
  SETTINGS: '/settings',

  // errors
  FORBIDDEN: '/403',
  SERVER_ERROR: '/500',
  NOT_FOUND: '/404',
} as const;

/** Literal paths only — the parameterised helpers are excluded. */
export type AppRoute = Extract<(typeof ROUTES)[keyof typeof ROUTES], string>;

/** Where to land after a successful login when there's no return path. */
export const DEFAULT_AUTHENTICATED_ROUTE = ROUTES.DASHBOARD;
/** Where guards send unauthenticated visitors. */
export const LOGIN_ROUTE = ROUTES.LOGIN;
