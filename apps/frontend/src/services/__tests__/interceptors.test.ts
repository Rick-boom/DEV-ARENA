import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  AxiosHeaders,
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { apiClient } from '../api-client.js';
import { tokenStore } from '../token-store.js';

/**
 * Interceptor behaviour, driven through a stub ADAPTER rather than a
 * mocked axios. Swapping the adapter keeps the real interceptor chain in
 * play, so these tests exercise the code that actually ships — the
 * refresh handshake, the replay, and the backoff — not a re-description
 * of it.
 */
function ok(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
}

function fail(status: number, config?: InternalAxiosRequestConfig): AxiosError {
  const cfg = config ?? ({ headers: new AxiosHeaders() } as InternalAxiosRequestConfig);
  const error = new AxiosError(`HTTP ${status}`);
  // Real axios always attaches the originating config; the response
  // interceptor needs it to replay the request after a refresh.
  error.config = cfg;
  error.response = {
    status,
    statusText: '',
    data: {},
    headers: new AxiosHeaders(),
    config: cfg,
  };
  return error;
}

const originalAdapter = apiClient.defaults.adapter;

beforeEach(() => {
  tokenStore.clear();
  apiClient.defaults.adapter = originalAdapter;
});

describe('request interceptor', () => {
  it('attaches the bearer token when one is held', async () => {
    tokenStore.set({ accessToken: 'tok-123', expiresAt: Date.now() + 60_000 });
    const seen: string[] = [];
    apiClient.defaults.adapter = ((config) => {
      seen.push(String(config.headers?.Authorization ?? ''));
      return Promise.resolve(ok({ data: { fine: true } }));
    }) as AxiosAdapter;

    await apiClient.get('/whatever');
    expect(seen[0]).toBe('Bearer tok-123');
  });

  it('sends no Authorization header when signed out', async () => {
    const seen: (string | undefined)[] = [];
    apiClient.defaults.adapter = ((config) => {
      seen.push(config.headers?.Authorization as string | undefined);
      return Promise.resolve(ok({ data: {} }));
    }) as AxiosAdapter;

    await apiClient.get('/whatever');
    expect(seen[0]).toBeUndefined();
  });
});

describe('401 refresh-and-retry', () => {
  it('refreshes once, then replays the original request with the new token', async () => {
    tokenStore.set({ accessToken: 'stale', expiresAt: Date.now() + 60_000 });
    const calls: string[] = [];

    apiClient.defaults.adapter = ((config) => {
      const url = config.url ?? '';
      calls.push(url);

      if (url.includes('/auth/refresh')) {
        return Promise.resolve(ok({ data: { accessToken: 'fresh' } }));
      }
      // First hit 401s; after the refresh the replay carries the new token.
      if (config.headers?.Authorization === 'Bearer stale') {
        return Promise.reject(fail(401, config));
      }
      return Promise.resolve(ok({ data: { protected: true } }));
    }) as AxiosAdapter;

    const response = await apiClient.get('/protected');

    expect(calls).toEqual(['/protected', '/auth/refresh', '/protected']);
    expect(response.data).toEqual({ data: { protected: true } });
    expect(tokenStore.getAccessToken()).toBe('fresh');
  });

  it('fires only ONE refresh when several requests 401 together', async () => {
    tokenStore.set({ accessToken: 'stale', expiresAt: Date.now() + 60_000 });
    let refreshCount = 0;

    apiClient.defaults.adapter = ((config) => {
      const url = config.url ?? '';
      if (url.includes('/auth/refresh')) {
        refreshCount += 1;
        return Promise.resolve(ok({ data: { accessToken: 'fresh' } }));
      }
      if (config.headers?.Authorization === 'Bearer stale') {
        return Promise.reject(fail(401, config));
      }
      return Promise.resolve(ok({ data: { url } }));
    }) as AxiosAdapter;

    await Promise.all([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);

    // Without single-flight this would be 3, and token rotation would
    // invalidate two of them.
    expect(refreshCount).toBe(1);
  });

  it('gives up and reports session expiry when the refresh itself fails', async () => {
    tokenStore.set({ accessToken: 'stale', expiresAt: Date.now() + 60_000 });
    const onExpired = vi.fn();
    tokenStore.onSessionExpired(onExpired);

    apiClient.defaults.adapter = ((config) => {
      return Promise.reject(fail(401, config));
    }) as AxiosAdapter;

    await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(AxiosError);
    expect(onExpired).toHaveBeenCalled();
    expect(tokenStore.getAccessToken()).toBeNull();
    tokenStore.onSessionExpired(null);
  });

  it('does not try to refresh a failed login', async () => {
    let refreshCount = 0;
    apiClient.defaults.adapter = ((config) => {
      if ((config.url ?? '').includes('/auth/refresh')) refreshCount += 1;
      return Promise.reject(fail(401, config));
    }) as AxiosAdapter;

    await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy();
    // Bad credentials are not an expired session — refreshing would be noise.
    expect(refreshCount).toBe(0);
  });
});

describe('transient-failure retry', () => {
  it('retries an idempotent GET with backoff, then succeeds', async () => {
    vi.useFakeTimers();
    let attempts = 0;

    apiClient.defaults.adapter = ((config) => {
      attempts += 1;
      if (attempts < 3) return Promise.reject(fail(503, config));
      return Promise.resolve(ok({ data: { recovered: true } }));
    }) as AxiosAdapter;

    const pending = apiClient.get('/flaky');
    await vi.runAllTimersAsync();
    const response = await pending;

    expect(attempts).toBe(3);
    expect(response.data).toEqual({ data: { recovered: true } });
    vi.useRealTimers();
  });

  it('never replays a POST — a double submit is worse than a failure', async () => {
    let attempts = 0;
    apiClient.defaults.adapter = ((config) => {
      attempts += 1;
      return Promise.reject(fail(503, config));
    }) as AxiosAdapter;

    await expect(apiClient.post('/orders', {})).rejects.toBeTruthy();
    expect(attempts).toBe(1);
  });

  it('does not retry a client error like 404', async () => {
    let attempts = 0;
    apiClient.defaults.adapter = ((config) => {
      attempts += 1;
      return Promise.reject(fail(404, config));
    }) as AxiosAdapter;

    await expect(apiClient.get('/missing')).rejects.toBeTruthy();
    expect(attempts).toBe(1);
  });

  it('stops after the attempt ceiling', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    apiClient.defaults.adapter = ((config) => {
      attempts += 1;
      return Promise.reject(fail(500, config));
    }) as AxiosAdapter;

    const pending = apiClient.get('/always-down');
    const assertion = expect(pending).rejects.toBeTruthy();
    await vi.runAllTimersAsync();
    await assertion;

    // 1 original + MAX_ATTEMPTS retries.
    expect(attempts).toBe(4);
    vi.useRealTimers();
  });
});
