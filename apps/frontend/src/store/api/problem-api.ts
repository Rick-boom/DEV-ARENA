import { PROBLEM_ENDPOINTS } from '@/constants/problems.js';
import { baseApi } from './base-api.js';
import type {
  DashboardSummary,
  Paginated,
  ProblemDetail,
  ProblemQuery,
  ProblemSummary,
} from '@/types/problem.types.js';

/** Facet values powering the filter menus. */
export interface ProblemFacets {
  tags: { value: string; count: number }[];
  companies: { value: string; count: number }[];
}

/**
 * Problem catalogue endpoints.
 *
 * Tags are per-id (`{ type: 'Problem', id }`) so bookmarking one problem
 * invalidates just that row and the list, not every cached problem —
 * without that granularity a single bookmark would refetch the whole
 * explorer.
 */
export const problemApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProblems: builder.query<Paginated<ProblemSummary>, ProblemQuery>({
      query: (params) => ({
        url: PROBLEM_ENDPOINTS.LIST,
        method: 'GET',
        params: {
          search: params.search || undefined,
          difficulty: params.difficulties.length ? params.difficulties.join(',') : undefined,
          tags: params.tags.length ? params.tags.join(',') : undefined,
          companies: params.companies.length ? params.companies.join(',') : undefined,
          status: params.status === 'all' ? undefined : params.status,
          sort: params.sort,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((p) => ({ type: 'Problem' as const, id: p.id })),
              { type: 'Problem' as const, id: 'LIST' },
            ]
          : [{ type: 'Problem' as const, id: 'LIST' }],
    }),

    getProblem: builder.query<ProblemDetail, string>({
      query: (idOrSlug) => ({ url: PROBLEM_ENDPOINTS.DETAIL(idOrSlug), method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'Problem', id }],
    }),

    getFacets: builder.query<ProblemFacets, void>({
      query: () => ({ url: PROBLEM_ENDPOINTS.FACETS, method: 'GET' }),
    }),

    toggleBookmark: builder.mutation<
      { bookmarked: boolean },
      { problemId: string; bookmarked: boolean }
    >({
      query: ({ problemId, bookmarked }) => ({
        url: PROBLEM_ENDPOINTS.BOOKMARK(problemId),
        method: bookmarked ? 'DELETE' : 'POST',
      }),
      /**
       * Optimistic: a bookmark star must respond instantly. The patch is
       * rolled back if the request fails, so the UI can never end up
       * claiming something the server rejected.
       */
      async onQueryStarted({ problemId, bookmarked }, { dispatch, queryFulfilled, getState }) {
        const patches = problemApi.util.selectInvalidatedBy(getState(), [
          { type: 'Problem', id: problemId },
        ]);
        const undo = patches.map(({ originalArgs, endpointName }) => {
          if (endpointName === 'listProblems') {
            return dispatch(
              problemApi.util.updateQueryData(
                'listProblems',
                originalArgs as ProblemQuery,
                (draft) => {
                  const row = draft.items.find((p) => p.id === problemId);
                  if (row) row.bookmarked = !bookmarked;
                },
              ),
            );
          }
          return dispatch(
            problemApi.util.updateQueryData('getProblem', originalArgs as string, (draft) => {
              draft.bookmarked = !bookmarked;
            }),
          );
        });
        try {
          await queryFulfilled;
        } catch {
          undo.forEach((patch) => patch.undo());
        }
      },
    }),

    getDashboard: builder.query<DashboardSummary, void>({
      query: () => ({ url: PROBLEM_ENDPOINTS.DASHBOARD, method: 'GET' }),
      providesTags: [{ type: 'Problem', id: 'DASHBOARD' }],
    }),
  }),
});

export const {
  useListProblemsQuery,
  useGetProblemQuery,
  useGetFacetsQuery,
  useToggleBookmarkMutation,
  useGetDashboardQuery,
} = problemApi;
