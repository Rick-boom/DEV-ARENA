import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './base-query.js';

/**
 * The single RTK Query API slice. Feature APIs extend it with
 * `injectEndpoints` so there's one cache, one middleware, and one set of
 * tag invalidations across the whole app.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Session', 'User', 'Problem', 'Submission'],
  endpoints: () => ({}),
});
