import { PROBLEM_ENDPOINTS } from '@/constants/problems.js';
import { baseApi } from './base-api.js';
import type { Language, RunResult } from '@/types/problem.types.js';

/**
 * Execution Engine binding — the "Run" button.
 *
 * Distinct from submission on purpose: running is a throwaway sandbox
 * call against sample or custom input with no verdict and no history,
 * whereas submitting is judged and permanent. Conflating them would
 * either pollute a user's record with experiments or make running slow.
 */
export const executionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    runCode: builder.mutation<
      RunResult,
      { problemId: string; language: Language; code: string; stdin: string }
    >({
      query: (body) => ({ url: PROBLEM_ENDPOINTS.RUN, method: 'POST', data: body }),
    }),
  }),
});

export const { useRunCodeMutation } = executionApi;
