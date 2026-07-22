import { describe, expect, it, beforeEach, vi } from 'vitest';
import { tokenStore } from '../token-store.js';
import { normalizeError } from '@/utils/error.js';
import { expiryOf, decodeJwt } from '@/utils/jwt.js';
import { AxiosError, AxiosHeaders } from 'axios';

describe('tokenStore', () => {
  beforeEach(() => tokenStore.clear());

  it('holds the token in memory only', () => {
    tokenStore.set({ accessToken: 'a.b.c', expiresAt: Date.now() + 60_000 });
    expect(tokenStore.getAccessToken()).toBe('a.b.c');
    // Nothing was written to storage — an XSS payload has nothing to read.
    expect(window.localStorage.getItem('accessToken')).toBeNull();
  });

  it('reports expiry against the refresh skew window', () => {
    tokenStore.set({ accessToken: 'a.b.c', expiresAt: Date.now() + 30_000 });
    expect(tokenStore.isExpired()).toBe(false);
    // Within a 60s skew the token counts as expired so we refresh early.
    expect(tokenStore.isExpired(60_000)).toBe(true);
  });

  it('treats a missing token as expired', () => {
    expect(tokenStore.isExpired()).toBe(true);
  });

  it('notifies the registered session-expiry handler', () => {
    const handler = vi.fn();
    tokenStore.onSessionExpired(handler);
    tokenStore.notifyExpired();
    expect(handler).toHaveBeenCalledOnce();
    tokenStore.onSessionExpired(null);
  });
});

describe('jwt helpers', () => {
  /** Builds an unsigned JWT with the given payload — enough to read exp. */
  function makeToken(payload: Record<string, unknown>): string {
    const encode = (obj: unknown): string =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
  }

  it('reads the exp claim', () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    expect(decodeJwt(makeToken({ exp }))?.exp).toBe(exp);
    expect(expiryOf(makeToken({ exp }))).toBe(exp * 1000);
  });

  it('falls back to a short window for an opaque token', () => {
    const before = Date.now();
    const expiry = expiryOf('not-a-jwt', 5_000);
    expect(expiry).toBeGreaterThanOrEqual(before + 4_000);
  });

  it('returns null rather than throwing on malformed input', () => {
    expect(decodeJwt('garbage')).toBeNull();
  });
});

describe('normalizeError', () => {
  function axiosError(status: number, data?: unknown): AxiosError {
    const error = new AxiosError('failed');
    error.response = {
      status,
      statusText: '',
      data,
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    };
    return error;
  }

  it('unwraps the server error envelope', () => {
    const result = normalizeError(
      axiosError(422, {
        success: false,
        error: { code: 'VALIDATION', message: 'Check the form', details: { email: ['Taken'] } },
      }),
    );
    expect(result).toMatchObject({ status: 422, code: 'VALIDATION', message: 'Check the form' });
    expect(result.details?.email).toEqual(['Taken']);
  });

  it('supplies an actionable message when the server sends none', () => {
    expect(normalizeError(axiosError(403)).message).toMatch(/don't have access/i);
    expect(normalizeError(axiosError(429)).message).toMatch(/wait a moment/i);
    expect(normalizeError(axiosError(503)).message).toMatch(/try again/i);
  });

  it('flags a request that never reached the server', () => {
    const result = normalizeError(new AxiosError('Network Error'));
    expect(result.isNetworkError).toBe(true);
    expect(result.status).toBe(0);
  });

  it('handles non-axios throwables', () => {
    expect(normalizeError(new Error('boom')).message).toBe('boom');
    expect(normalizeError('weird').code).toBe('UNKNOWN_ERROR');
  });
});
