import { describe, expect, it } from 'vitest';
import {
  editorReducer,
  draftChanged,
  draftHydrated,
  draftReset,
  draftKey,
  languageChanged,
  fontSizeStepped,
  preferencesChanged,
} from '../slices/editor-slice.js';
import {
  workspaceReducer,
  consoleTabChanged,
  consoleToggled,
  hintRevealed,
  problemTabChanged,
  ConsoleTab,
  ProblemTab,
} from '../slices/workspace-slice.js';
import {
  problemReducer,
  difficultyToggled,
  pageChanged,
  searchChanged,
  sortChanged,
  filtersCleared,
} from '../slices/problem-slice.js';
import {
  submissionReducer,
  runStarted,
  runSucceeded,
  runFailed,
  submitStarted,
  submitQueued,
  submitResolved,
  workspaceReset,
  RunStatus,
  isPendingVerdict,
} from '../slices/submission-slice.js';
import { EDITOR_DEFAULTS } from '@/constants/editor.js';
import { Difficulty, Language, ProblemSort, Verdict } from '@/types/problem.types.js';
import type { RunResult, SubmissionDetail } from '@/types/problem.types.js';

describe('editor slice', () => {
  const problemId = 'p1';

  it('keeps drafts separate per language', () => {
    let state = editorReducer(
      undefined,
      draftChanged({ problemId, language: Language.PYTHON, code: 'print(1)' }),
    );
    state = editorReducer(
      state,
      draftChanged({ problemId, language: Language.JAVASCRIPT, code: 'console.log(1)' }),
    );

    // Switching language must never destroy work in the other one.
    expect(state.drafts[draftKey(problemId, Language.PYTHON)]).toBe('print(1)');
    expect(state.drafts[draftKey(problemId, Language.JAVASCRIPT)]).toBe('console.log(1)');
  });

  it('hydrates a draft only when none exists', () => {
    let state = editorReducer(
      undefined,
      draftChanged({ problemId, language: Language.PYTHON, code: 'my work' }),
    );
    state = editorReducer(
      state,
      draftHydrated({ problemId, language: Language.PYTHON, code: 'STARTER' }),
    );
    // Hydration must not clobber existing work.
    expect(state.drafts[draftKey(problemId, Language.PYTHON)]).toBe('my work');
  });

  it('reset replaces the draft with starter code', () => {
    let state = editorReducer(
      undefined,
      draftChanged({ problemId, language: Language.PYTHON, code: 'broken' }),
    );
    state = editorReducer(
      state,
      draftReset({ problemId, language: Language.PYTHON, code: 'STARTER' }),
    );
    expect(state.drafts[draftKey(problemId, Language.PYTHON)]).toBe('STARTER');
  });

  it('marks the buffer dirty on edit', () => {
    const state = editorReducer(
      undefined,
      draftChanged({ problemId, language: Language.PYTHON, code: 'x' }),
    );
    expect(state.isDirty).toBe(true);
  });

  it('changes language', () => {
    const state = editorReducer(undefined, languageChanged(Language.CPP));
    expect(state.language).toBe(Language.CPP);
  });

  it('clamps font size to the allowed range', () => {
    let state = editorReducer(
      undefined,
      preferencesChanged({ fontSize: EDITOR_DEFAULTS.maxFontSize }),
    );
    state = editorReducer(state, fontSizeStepped(1));
    expect(state.preferences.fontSize).toBe(EDITOR_DEFAULTS.maxFontSize);

    state = editorReducer(state, preferencesChanged({ fontSize: EDITOR_DEFAULTS.minFontSize }));
    state = editorReducer(state, fontSizeStepped(-1));
    expect(state.preferences.fontSize).toBe(EDITOR_DEFAULTS.minFontSize);
  });

  it('toggles view preferences', () => {
    const state = editorReducer(undefined, preferencesChanged({ minimap: true, wordWrap: false }));
    expect(state.preferences.minimap).toBe(true);
    expect(state.preferences.wordWrap).toBe(false);
  });
});

describe('workspace slice', () => {
  it('switching console tab also opens the console', () => {
    let state = workspaceReducer(undefined, consoleToggled());
    expect(state.consoleOpen).toBe(false);
    state = workspaceReducer(state, consoleTabChanged(ConsoleTab.OUTPUT));
    expect(state.consoleOpen).toBe(true);
    expect(state.consoleTab).toBe(ConsoleTab.OUTPUT);
  });

  it('changes the problem tab', () => {
    const state = workspaceReducer(undefined, problemTabChanged(ProblemTab.SUBMISSIONS));
    expect(state.problemTab).toBe(ProblemTab.SUBMISSIONS);
  });

  it('reveals hints one at a time without duplicates', () => {
    let state = workspaceReducer(undefined, hintRevealed('h1'));
    state = workspaceReducer(state, hintRevealed('h1'));
    state = workspaceReducer(state, hintRevealed('h2'));
    expect(state.revealedHints).toEqual(['h1', 'h2']);
  });
});

describe('problem slice', () => {
  it('resets to page 1 whenever a filter changes', () => {
    let state = problemReducer(undefined, pageChanged(7));
    expect(state.query.page).toBe(7);

    state = problemReducer(state, difficultyToggled(Difficulty.HARD));
    // Staying on page 7 after narrowing results shows an empty screen.
    expect(state.query.page).toBe(1);
    expect(state.query.difficulties).toEqual([Difficulty.HARD]);
  });

  it('toggles a difficulty off when applied twice', () => {
    let state = problemReducer(undefined, difficultyToggled(Difficulty.EASY));
    state = problemReducer(state, difficultyToggled(Difficulty.EASY));
    expect(state.query.difficulties).toEqual([]);
  });

  it('search and sort also reset the page', () => {
    let state = problemReducer(undefined, pageChanged(4));
    state = problemReducer(state, searchChanged('graph'));
    expect(state.query.page).toBe(1);

    state = problemReducer(state, pageChanged(3));
    state = problemReducer(state, sortChanged(ProblemSort.ACCEPTANCE));
    expect(state.query.page).toBe(1);
  });

  it('clears every filter at once', () => {
    let state = problemReducer(undefined, searchChanged('dp'));
    state = problemReducer(state, difficultyToggled(Difficulty.MEDIUM));
    state = problemReducer(state, filtersCleared());
    expect(state.query.search).toBe('');
    expect(state.query.difficulties).toEqual([]);
  });
});

describe('submission slice', () => {
  const runResult: RunResult = {
    stdout: '4',
    stderr: '',
    exitCode: 0,
    runtimeMs: 12,
    memoryKb: 2048,
    timedOut: false,
  };

  it('tracks the run lifecycle', () => {
    let state = submissionReducer(undefined, runStarted());
    expect(state.runStatus).toBe(RunStatus.RUNNING);
    expect(state.runResult).toBeNull();

    state = submissionReducer(state, runSucceeded(runResult));
    expect(state.runStatus).toBe(RunStatus.DONE);
    expect(state.runResult?.stdout).toBe('4');
  });

  it('records a run failure message', () => {
    const state = submissionReducer(undefined, runFailed('engine down'));
    expect(state.runStatus).toBe(RunStatus.FAILED);
    expect(state.runError).toBe('engine down');
  });

  it('holds the submission id while judging, then clears it on resolve', () => {
    let state = submissionReducer(undefined, submitStarted());
    state = submissionReducer(state, submitQueued('sub-1'));
    expect(state.activeSubmissionId).toBe('sub-1');

    const detail: SubmissionDetail = {
      id: 'sub-1',
      problemId: 'p1',
      language: Language.PYTHON,
      status: Verdict.ACCEPTED,
      runtimeMs: 40,
      memoryKb: 4096,
      createdAt: new Date().toISOString(),
      passed: 10,
      total: 10,
      results: [],
    };
    state = submissionReducer(state, submitResolved(detail));
    expect(state.activeSubmissionId).toBeNull();
    expect(state.lastSubmission?.status).toBe(Verdict.ACCEPTED);
  });

  it('reset clears transient results but keeps custom input', () => {
    let state = submissionReducer(undefined, runSucceeded(runResult));
    state = { ...state, customInput: '5 3' };
    state = submissionReducer(state, workspaceReset());
    expect(state.runResult).toBeNull();
    expect(state.customInput).toBe('5 3');
  });

  it('identifies non-terminal verdicts', () => {
    expect(isPendingVerdict(Verdict.QUEUED)).toBe(true);
    expect(isPendingVerdict(Verdict.RUNNING)).toBe(true);
    expect(isPendingVerdict(Verdict.ACCEPTED)).toBe(false);
    expect(isPendingVerdict(Verdict.WRONG_ANSWER)).toBe(false);
  });
});
