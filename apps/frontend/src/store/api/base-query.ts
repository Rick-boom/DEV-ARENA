import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig } from 'axios';
import { apiClient, ensureFreshToken } from '@/services/api-client.js';
import { normalizeError } from '@/utils/error.js';
import type { NormalizedError } from '@/types/api.types.js';

export interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: AxiosRequestConfig['params'];
}

/**
 * RTK Query on top of OUR axios instance rather than fetchBaseQuery.
 *
 * This matters: all the auth behaviour (bearer injection, single-flight
 * refresh, retry) already lives in the axios interceptors. Using
 * fetchBaseQuery would mean re-implementing every one of those rules in
 * a second place. One transport, one set of rules.
 *
 * Errors come back already normalized, so every RTKQ hook exposes the
 * same `error` shape to components.
 */
export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, NormalizedError> =>
  async ({ url, method = 'GET', data, params }) => {
    try {
      await ensureFreshToken();
      const result = await apiClient.request({ url, method, data, params });
      // Unwrap the { success, data } envelope; tolerate bare payloads.
      const body = result.data as { data?: unknown } | undefined;
      return { data: body && 'data' in body ? body.data : result.data };
    } catch (error) {
      return { error: normalizeError(error) };
    }
  };
