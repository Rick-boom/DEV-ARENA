/** API base + endpoint map. Endpoints are functions when they take params. */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  SIGNUP: '/auth/register',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  ME: '/auth/me',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_EMAIL: '/auth/verify-email',
  RESEND_VERIFICATION: '/auth/resend-verification',
  OAUTH_START: (provider: string) => `/auth/oauth/${provider}`,
  OAUTH_EXCHANGE: '/auth/oauth/exchange',
} as const;

export const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
} as const;

/** Requests that must never trigger the refresh-and-retry loop. */
export const NO_REFRESH_PATHS: string[] = [
  AUTH_ENDPOINTS.LOGIN,
  AUTH_ENDPOINTS.SIGNUP,
  AUTH_ENDPOINTS.REFRESH,
  AUTH_ENDPOINTS.LOGOUT,
];
