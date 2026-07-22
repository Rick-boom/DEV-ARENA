import type { Language, SubmissionStatus } from '@prisma/client';

/**
 * Judge domain types. Verdicts reuse the existing SubmissionStatus enum
 * (which already includes all 13 the spec lists), so there is NO schema
 * change — the durable record and the judge vocabulary are one and the
 * same.
 */
export type Verdict = SubmissionStatus;

/** Test-case categories (from TestCase.isHidden + naming convention). */
export const TestCaseKind = {
  PUBLIC: 'PUBLIC',
  HIDDEN: 'HIDDEN',
  SAMPLE: 'SAMPLE',
  STRESS: 'STRESS',
  EDGE: 'EDGE',
} as const;
export type TestCaseKind = (typeof TestCaseKind)[keyof typeof TestCaseKind];

/** A test case as the judge sees it. */
export interface JudgeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
  order: number;
}

/** Problem judging config resolved once per submission. */
export interface JudgeProblem {
  problemId: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  /** how to compare output: token/exact/float/custom */
  comparator: ComparatorKind;
  testCases: JudgeTestCase[];
}

export const ComparatorKind = {
  TOKEN: 'TOKEN', // whitespace-normalized token compare (default)
  EXACT: 'EXACT', // byte-for-byte
  FLOAT: 'FLOAT', // numeric tolerance
  CUSTOM: 'CUSTOM', // special-judge / checker
} as const;
export type ComparatorKind = (typeof ComparatorKind)[keyof typeof ComparatorKind];

/** One test case's outcome. */
export interface TestCaseResult {
  testCaseId: string;
  verdict: Verdict;
  runtimeMs: number;
  memoryKb: number;
  /** truncated stderr for the user (never leaks expected output) */
  stderr?: string;
  /** points earned on this case = weight if ACCEPTED else 0 (or partial) */
  score: number;
  maxScore: number;
  skipped: boolean;
}

/** The aggregate judgement for a submission. */
export interface JudgeResult {
  submissionId: string;
  verdict: Verdict; // overall verdict (first non-accepted, or ACCEPTED)
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: number;
  total: number;
  runtimeMs: number; // max across cases
  peakMemoryKb: number; // max across cases
  compileTimeMs: number;
  executionTimeMs: number; // total wall time judging
  results: TestCaseResult[];
}

/** What the (assumed) Execution Engine returns for one run. */
export interface ExecutionOutcome {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  memoryUsedMb: number;
  oomKilled: boolean;
  timedOut: boolean;
  truncated: boolean;
  compileError?: string;
}

/** A submission handed to the queue/worker. */
export interface SubmissionJob {
  submissionId: string;
  userId: string;
  problemId: string;
  battleId?: string;
  language: Language;
  code: string;
  /** stop scoring after the first failing case (contest speed) */
  stopOnFirstFail: boolean;
  /** allow partial credit by test-case weight */
  partialScoring: boolean;
}

/** Judge lifecycle events published for other services (battle, etc.). */
export const JudgeEvent = {
  CREATED: 'submission.created',
  STARTED: 'submission.started',
  RUNNING: 'submission.running',
  COMPLETED: 'submission.completed',
  FAILED: 'submission.failed',
  VERDICT: 'submission.verdict',
} as const;
export type JudgeEvent = (typeof JudgeEvent)[keyof typeof JudgeEvent];
