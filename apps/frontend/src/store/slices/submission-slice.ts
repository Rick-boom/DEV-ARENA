import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { Verdict, type RunResult, type SubmissionDetail } from '@/types/problem.types.js';

/**
 * Run + submit state.
 *
 * The two are tracked separately because they can legitimately overlap
 * in the UI (a user can read the last run's output while a submission is
 * being judged) and because only submissions have a verdict lifecycle.
 *
 * `activeSubmissionId` is what the polling hook watches; it clears once
 * the verdict reaches a terminal state.
 */
export const RunStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export interface SubmissionState {
  runStatus: RunStatus;
  runResult: RunResult | null;
  runError: string | null;
  customInput: string;
  useCustomInput: boolean;

  submitStatus: RunStatus;
  activeSubmissionId: string | null;
  lastSubmission: SubmissionDetail | null;
  submitError: string | null;
}

const initialState: SubmissionState = {
  runStatus: RunStatus.IDLE,
  runResult: null,
  runError: null,
  customInput: '',
  useCustomInput: false,

  submitStatus: RunStatus.IDLE,
  activeSubmissionId: null,
  lastSubmission: null,
  submitError: null,
};

const submissionSlice = createSlice({
  name: 'submission',
  initialState,
  reducers: {
    runStarted(state) {
      state.runStatus = RunStatus.RUNNING;
      state.runError = null;
      state.runResult = null;
    },
    runSucceeded(state, action: PayloadAction<RunResult>) {
      state.runStatus = RunStatus.DONE;
      state.runResult = action.payload;
    },
    runFailed(state, action: PayloadAction<string>) {
      state.runStatus = RunStatus.FAILED;
      state.runError = action.payload;
    },
    customInputChanged(state, action: PayloadAction<string>) {
      state.customInput = action.payload;
    },
    customInputToggled(state) {
      state.useCustomInput = !state.useCustomInput;
    },

    submitStarted(state) {
      state.submitStatus = RunStatus.RUNNING;
      state.submitError = null;
      state.lastSubmission = null;
    },
    submitQueued(state, action: PayloadAction<string>) {
      state.activeSubmissionId = action.payload;
    },
    /** Polling result — terminal verdicts stop the poll. */
    submitResolved(state, action: PayloadAction<SubmissionDetail>) {
      state.lastSubmission = action.payload;
      state.submitStatus = RunStatus.DONE;
      state.activeSubmissionId = null;
    },
    submitFailed(state, action: PayloadAction<string>) {
      state.submitStatus = RunStatus.FAILED;
      state.submitError = action.payload;
      state.activeSubmissionId = null;
    },
    /** Clears transient results when moving to another problem. */
    workspaceReset(state) {
      return { ...initialState, customInput: state.customInput };
    },
  },
});

export const {
  runStarted,
  runSucceeded,
  runFailed,
  customInputChanged,
  customInputToggled,
  submitStarted,
  submitQueued,
  submitResolved,
  submitFailed,
  workspaceReset,
} = submissionSlice.actions;

export const submissionReducer = submissionSlice.reducer;

/** True while the judge still owes us a verdict. */
export function isPendingVerdict(verdict: Verdict | undefined): boolean {
  return verdict === Verdict.PENDING || verdict === Verdict.QUEUED || verdict === Verdict.RUNNING;
}
