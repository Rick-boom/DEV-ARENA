import type { AuthTokens } from '@/types/auth.types.js';

/**
 * In-memory access-token holder.
 *
 * The access token deliberately never touches localStorage: anything in
 * localStorage is readable by any XSS payload on the page. It lives in a
 * module closure for the tab's lifetime, and the long-lived REFRESH
 * token stays in an httpOnly cookie the JS can't read at all. Session
 * recovery on reload works by calling /auth/refresh with that cookie.
 *
 * This module is framework-free on purpose — the axios interceptors need
 * the token synchronously, without reaching into React or Redux.
 */
let tokens: AuthTokens | null = null;
let onExpired: (() => void) | null = null;

export const tokenStore = {
  get(): AuthTokens | null {
    return tokens;
  },
  getAccessToken(): string | null {
    return tokens?.accessToken ?? null;
  },
  set(next: AuthTokens | null): void {
    tokens = next;
  },
  clear(): void {
    tokens = null;
  },
  /** True when the token is missing or within the refresh skew window. */
  isExpired(skewMs = 0): boolean {
    if (!tokens) return true;
    return Date.now() >= tokens.expiresAt - skewMs;
  },
  /** Registered by the store so the network layer can force a logout. */
  onSessionExpired(handler: (() => void) | null): void {
    onExpired = handler;
  },
  notifyExpired(): void {
    onExpired?.();
  },
};
