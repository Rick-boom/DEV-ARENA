import { Difficulty, ProblemSort, SolvedFilter, type ProblemQuery } from '@/types/problem.types.js';

/** Explorer defaults + display metadata. */
export const DEFAULT_PROBLEM_QUERY: ProblemQuery = {
  search: '',
  difficulties: [],
  tags: [],
  companies: [],
  status: SolvedFilter.ALL,
  sort: ProblemSort.NEWEST,
  page: 1,
  pageSize: 25,
};

/**
 * Difficulty colours map onto the semantic ramp rather than raw hex, so
 * they invert correctly with the light theme.
 */
export const DIFFICULTY_META: Record<Difficulty, { label: string; className: string }> = {
  [Difficulty.EASY]: { label: 'Easy', className: 'text-[var(--color-success)]' },
  [Difficulty.MEDIUM]: { label: 'Medium', className: 'text-[var(--color-warning)]' },
  [Difficulty.HARD]: { label: 'Hard', className: 'text-[var(--color-danger)]' },
};

export const SORT_LABELS: Record<ProblemSort, string> = {
  [ProblemSort.NEWEST]: 'Newest',
  [ProblemSort.TITLE]: 'Title',
  [ProblemSort.DIFFICULTY]: 'Difficulty',
  [ProblemSort.ACCEPTANCE]: 'Acceptance',
};

export const STATUS_LABELS: Record<SolvedFilter, string> = {
  [SolvedFilter.ALL]: 'All',
  [SolvedFilter.SOLVED]: 'Solved',
  [SolvedFilter.UNSOLVED]: 'Unsolved',
  [SolvedFilter.BOOKMARKED]: 'Bookmarked',
};

export const PROBLEM_ENDPOINTS = {
  LIST: '/problems',
  DETAIL: (idOrSlug: string) => `/problems/${idOrSlug}`,
  BOOKMARK: (id: string) => `/problems/${id}/bookmark`,
  FACETS: '/problems/facets',
  DASHBOARD: '/me/dashboard',
  RUN: '/execute',
  SUBMIT: '/submission',
  SUBMISSION: (id: string) => `/submission/${id}`,
  SUBMISSION_RESULT: '/submission/result',
  SUBMISSION_HISTORY: '/submission/history',
} as const;
