import type { AxiosError } from 'axios';
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL, AUTH_ENDPOINTS, HTTP_STATUS, NO_REFRESH_PATHS } from '@/constants/api.js';
import { RETRY, SESSION } from '@/constants/app.js';
import { tokenStore } from './token-store.js';
import { expiryOf } from '@/utils/jwt.js';
import type { ApiEnvelope } from '@/types/api.types.js';

/**
 * The single HTTP client for the app.
 *
 * Three responsibilities, each isolated in its own interceptor:
 *  1. attach the bearer token (request),
 *  2. refresh-once-and-retry on 401 (response),
 *  3. bounded exponential-backoff retry for transient failures (response).
 *
 * `withCredentials` is on so the httpOnly refresh cookie rides along.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Config flags we add ourselves; kept off the public Axios types. */
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _refreshRetried?: boolean;
  /** opt a request out of the auth header (used by the refresh call) */
  _skipAuth?: boolean;
}

// ── 1. request: attach the access token ──────────────────────────────
apiClient.interceptors.request.use((config) => {
  const cfg = config as RetryableConfig;
  const token = tokenStore.getAccessToken();
  if (token && !cfg._skipAuth) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// ── single-flight refresh ────────────────────────────────────────────
/**
 * When several requests 401 at once, only ONE refresh call should go out
 * and the rest must wait for its result. Without this the app fires N
 * refreshes, and with rotating refresh tokens all but one would fail and
 * log the user out spuriously.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async (): Promise<string | null> => {
    try {
      const res = await apiClient.post<ApiEnvelope<{ accessToken: string }>>(
        AUTH_ENDPOINTS.REFRESH,
        {},
        { _skipAuth: true } as AxiosRequestConfig,
      );
      const accessToken = res.data.data.accessToken;
      tokenStore.set({ accessToken, expiresAt: expiryOf(accessToken) });
      return accessToken;
    } catch {
      // The refresh cookie is gone or rejected → the session is over.
      tokenStore.clear();
      tokenStore.notifyExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/** Proactive refresh: called before a request when the token is near expiry. */
export async function ensureFreshToken(): Promise<void> {
  if (tokenStore.get() && tokenStore.isExpired(SESSION.REFRESH_SKEW_MS)) {
    await refreshAccessToken();
  }
}

// ── 2 + 3. response: refresh-on-401, then bounded retry ──────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    if (!config) return Promise.reject(error);

    const url = config.url ?? '';
    const isAuthPath = NO_REFRESH_PATHS.some((p) => url.includes(p));

    // 401 → refresh once, then replay the original request.
    if (
      error.response?.status === HTTP_STATUS.UNAUTHORIZED &&
      !config._refreshRetried &&
      !isAuthPath
    ) {
      config._refreshRetried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient.request(config);
      }
      return Promise.reject(error);
    }

    // Transient failure → exponential backoff, idempotent verbs only.
    // Replaying a POST could double-submit; GET/HEAD/OPTIONS are safe.
    const method = (config.method ?? 'get').toLowerCase();
    const status = error.response?.status;
    const isTransient =
      !error.response || (status !== undefined && RETRY.RETRYABLE_STATUSES.includes(status));

    if (isTransient && RETRY.RETRYABLE_METHODS.includes(method)) {
      const attempt = (config._retryCount ?? 0) + 1;
      if (attempt <= RETRY.MAX_ATTEMPTS) {
        config._retryCount = attempt;
        const delay = RETRY.BASE_DELAY_MS * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient.request(config);
      }
    }

    return Promise.reject(error);
  },
);

/** Unwraps the { success, data } envelope so callers get the payload. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.request<ApiEnvelope<T>>(config);
  return response.data.data;
}
