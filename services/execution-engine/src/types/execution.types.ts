/**
 * Wire + domain types for the execution service. Shared by the API,
 * the queue payload, the worker, and the tests so every layer speaks
 * the same shape.
 */

export const SUPPORTED_LANGUAGES = ['cpp', 'java', 'python', 'javascript'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Terminal states of a submission. These are the ONLY values the API
 * returns in `status`, matching the spec's "SUPPORTED RESULTS".
 */
export const ExecutionStatus = {
  ACCEPTED: 'ACCEPTED',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  OUTPUT_LIMIT_EXCEEDED: 'OUTPUT_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

/** Optional per-request overrides. They may only TIGHTEN the ceilings. */
export interface ResourceLimits {
  timeLimitMs?: number;
  memoryLimitMb?: number;
}

/** What a client POSTs to /execute. */
export interface ExecutionRequest {
  language: Language;
  code: string;
  input?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  priority?: number; // lower = sooner (BullMQ convention)
}

/** The job payload placed on the queue (already validated + resolved). */
export interface ExecutionJobData {
  language: Language;
  code: string;
  input: string;
  limits: {
    timeLimitMs: number;
    memoryLimitMb: number;
    compileMs: number;
    cpuCores: number;
    pids: number;
    outputBytes: number;
    tmpfsMb: number;
  };
  submittedAt: number;
}

/** What the worker produces and the API returns. */
export interface ExecutionResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  memoryUsedMb: number;
  /** true when stdout/stderr were truncated at the output ceiling */
  truncated: boolean;
}
