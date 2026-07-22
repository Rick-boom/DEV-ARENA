import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_PROBLEM_QUERY } from '@/constants/problems.js';
import type { Difficulty, ProblemQuery, ProblemSort, SolvedFilter } from '@/types/problem.types.js';

/**
 * Explorer query state. Held in Redux rather than component state so the
 * filter bar, the results list, and the URL sync can all read the same
 * query without prop-drilling — and so returning to the explorer
 * preserves what the user was looking at.
 *
 * Every filter mutation resets the page to 1: staying on page 7 after
 * narrowing to 12 results shows an empty screen and reads as a bug.
 */
export interface ProblemState {
  query: ProblemQuery;
}

const initialState: ProblemState = { query: { ...DEFAULT_PROBLEM_QUERY } };

/** Adds or removes a value from a filter array. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

const problemSlice = createSlice({
  name: 'problem',
  initialState,
  reducers: {
    searchChanged(state, action: PayloadAction<string>) {
      state.query.search = action.payload;
      state.query.page = 1;
    },
    difficultyToggled(state, action: PayloadAction<Difficulty>) {
      state.query.difficulties = toggle(state.query.difficulties, action.payload);
      state.query.page = 1;
    },
    tagToggled(state, action: PayloadAction<string>) {
      state.query.tags = toggle(state.query.tags, action.payload);
      state.query.page = 1;
    },
    companyToggled(state, action: PayloadAction<string>) {
      state.query.companies = toggle(state.query.companies, action.payload);
      state.query.page = 1;
    },
    statusChanged(state, action: PayloadAction<SolvedFilter>) {
      state.query.status = action.payload;
      state.query.page = 1;
    },
    sortChanged(state, action: PayloadAction<ProblemSort>) {
      state.query.sort = action.payload;
      state.query.page = 1;
    },
    pageChanged(state, action: PayloadAction<number>) {
      state.query.page = Math.max(1, action.payload);
    },
    filtersCleared(state) {
      state.query = { ...DEFAULT_PROBLEM_QUERY };
    },
    /** Rehydrates the query from the URL on first load / back navigation. */
    queryHydrated(state, action: PayloadAction<Partial<ProblemQuery>>) {
      state.query = { ...state.query, ...action.payload };
    },
  },
});

export const {
  searchChanged,
  difficultyToggled,
  tagToggled,
  companyToggled,
  statusChanged,
  sortChanged,
  pageChanged,
  filtersCleared,
  queryHydrated,
} = problemSlice.actions;

export const problemReducer = problemSlice.reducer;
