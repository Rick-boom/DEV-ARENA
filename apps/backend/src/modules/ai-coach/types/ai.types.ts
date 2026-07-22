import type { SupportedLanguage } from '../constants/ai.constants.js';

/**
 * AI Coach domain types. The service is organized around MODES — each a
 * distinct coaching intent with its own system prompt, template, and
 * structured-output schema — so behavior stays predictable and every
 * mode can be tuned/tested in isolation.
 */
export const AiMode = {
  HINT: 'hint',
  COMPLEXITY: 'complexity',
  REVIEW: 'review',
  INTERVIEW: 'interview',
  LEARNING: 'learning',
  RECOMMENDATION: 'recommendation',
} as const;
export type AiMode = (typeof AiMode)[keyof typeof AiMode];

/** Problem metadata used to GROUND the model (prevents hallucination). */
export interface ProblemContext {
  problemId: string;
  title: string;
  statement: string;
  constraints: string;
  difficulty: string;
  topics: string[];
  /** NEVER placed in a prompt — presence lets the validator detect leaks. */
  editorialText?: string;
  hiddenTestInputs?: string[];
}

/** The user's attempt + judge signal. */
export interface SubmissionContext {
  code: string;
  language: SupportedLanguage;
  verdict?: string; // ACCEPTED / WRONG_ANSWER / ...
  runtimeMs?: number;
  memoryKb?: number;
  failingCaseSummary?: string; // high-level only, never raw hidden input
  attemptCount?: number;
  recentVerdicts?: string[];
}

/** Everything the coach reasons over for one request. */
export interface CoachContext {
  problem: ProblemContext;
  submission?: SubmissionContext;
  /** derived weak topics from history, for learning/recommendation modes */
  weakTopics?: string[];
  solvedTopics?: string[];
}

export interface CoachRequest {
  userId: string;
  mode: AiMode;
  problemId: string;
  code?: string;
  language?: SupportedLanguage;
  /** free-text follow-up question from the user (untrusted) */
  question?: string;
}

/**
 * Structured coach response. The model is asked to return JSON matching
 * this shape (structured output), so downstream code and the UI get a
 * predictable contract instead of free prose that might smuggle a full
 * solution.
 */
export interface CoachResponse {
  mode: AiMode;
  /** short, focused guidance — never a full solution */
  summary: string;
  /** escalating bullets: hints, review points, complexity notes, etc. */
  points: string[];
  /** optional Big-O findings for complexity mode */
  complexity?: { time: string; space: string; explanation: string };
  /** interview questions / follow-ups for interview mode */
  questions?: string[];
  /** learning resources / next problems for learning & recommendation modes */
  recommendations?: { title: string; reason: string; topic?: string; problemId?: string }[];
  /** which hint level this was (hint mode) */
  hintLevel?: number;
  meta: {
    cached: boolean;
    model: string;
    latencyMs: number;
    tokensIn?: number;
    tokensOut?: number;
  };
}

/** Persisted (Redis) record of one interaction for GET /ai/history. */
export interface InteractionRecord {
  id: string;
  mode: AiMode;
  problemId: string;
  at: number;
  cached: boolean;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  summary: string;
}
