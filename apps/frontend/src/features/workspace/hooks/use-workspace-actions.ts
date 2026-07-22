import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectEditor, selectSubmissionState } from '@/store/selectors.js';
import {
  runFailed,
  runStarted,
  runSucceeded,
  submitFailed,
  submitQueued,
  submitStarted,
} from '@/store/slices/submission-slice.js';
import { consoleTabChanged, ConsoleTab } from '@/store/slices/workspace-slice.js';
import { useRunCodeMutation } from '@/store/api/execution-api.js';
import { useCreateSubmissionMutation } from '@/store/api/submission-api.js';
import { useNotify } from '@/hooks/use-notify.js';
import { draftKey } from '@/store/slices/editor-slice.js';
import type { NormalizedError } from '@/types/api.types.js';
import type { PublicTestCase } from '@/types/problem.types.js';

/**
 * Run and Submit, in one place.
 *
 * Both actions need the same five things (current draft, language,
 * problem id, console focus, error handling), so keeping them together
 * stops the toolbar, the editor's keybindings and the console from each
 * growing their own slightly different copy.
 *
 * Errors are handled here rather than thrown: a failed run is a normal
 * outcome of writing code, not an exception the UI should crash on.
 */
export function useWorkspaceActions(problemId: string, testCases: PublicTestCase[]) {
  const dispatch = useAppDispatch();
  const notify = useNotify();
  const { language, drafts } = useAppSelector(selectEditor);
  const { customInput, useCustomInput } = useAppSelector(selectSubmissionState);

  const [runCode, runState] = useRunCodeMutation();
  const [createSubmission, submitState] = useCreateSubmissionMutation();

  const code = drafts[draftKey(problemId, language)] ?? '';

  const run = useCallback(async (): Promise<void> => {
    if (!code.trim()) {
      notify.warning('Nothing to run', 'Write some code first.');
      return;
    }
    dispatch(consoleTabChanged(ConsoleTab.OUTPUT));
    dispatch(runStarted());
    try {
      const stdin = useCustomInput ? customInput : (testCases[0]?.input ?? '');
      const result = await runCode({ problemId, language, code, stdin }).unwrap();
      dispatch(runSucceeded(result));
    } catch (error) {
      dispatch(runFailed((error as NormalizedError).message));
    }
  }, [
    code,
    customInput,
    dispatch,
    language,
    notify,
    problemId,
    runCode,
    testCases,
    useCustomInput,
  ]);

  const submit = useCallback(async (): Promise<void> => {
    if (!code.trim()) {
      notify.warning('Nothing to submit', 'Write some code first.');
      return;
    }
    dispatch(consoleTabChanged(ConsoleTab.RESULT));
    dispatch(submitStarted());
    try {
      const { submissionId } = await createSubmission({ problemId, language, code }).unwrap();
      // Judging is async — the polling hook takes it from here.
      dispatch(submitQueued(submissionId));
    } catch (error) {
      const normalized = error as NormalizedError;
      dispatch(submitFailed(normalized.message));
      notify.error('Submission failed', normalized.message);
    }
  }, [code, createSubmission, dispatch, language, notify, problemId]);

  return {
    run,
    submit,
    isRunning: runState.isLoading,
    isSubmitting: submitState.isLoading,
  };
}
