import { PROBLEM_ENDPOINTS } from '@/constants/problems.js';
import { baseApi } from './base-api.js';
import type { Language, Submission, SubmissionDetail } from '@/types/problem.types.js';

/**
 * Judge Service binding.
 *
 * `createSubmission` returns 202 with an id — judging is asynchronous —
 * so the workspace polls `getSubmission` until the verdict reaches a
 * terminal state. Invalidating the history tag on create keeps the
 * submissions panel current without a manual refetch.
 */
export const submissionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createSubmission: builder.mutation<
      { submissionId: string },
      { problemId: string; language: Language; code: string; battleId?: string }
    >({
      query: (body) => ({ url: PROBLEM_ENDPOINTS.SUBMIT, method: 'POST', data: body }),
      invalidatesTags: [{ type: 'Submission', id: 'HISTORY' }],
    }),

    getSubmission: builder.query<SubmissionDetail, string>({
      query: (id) => ({ url: PROBLEM_ENDPOINTS.SUBMISSION(id), method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'Submission', id }],
    }),

    getSubmissionHistory: builder.query<Submission[], { problemId?: string; limit?: number }>({
      query: ({ problemId, limit = 20 }) => ({
        url: PROBLEM_ENDPOINTS.SUBMISSION_HISTORY,
        method: 'GET',
        params: { problemId, limit },
      }),
      providesTags: [{ type: 'Submission', id: 'HISTORY' }],
    }),
  }),
});

export const {
  useCreateSubmissionMutation,
  useGetSubmissionQuery,
  useLazyGetSubmissionQuery,
  useGetSubmissionHistoryQuery,
} = submissionApi;
