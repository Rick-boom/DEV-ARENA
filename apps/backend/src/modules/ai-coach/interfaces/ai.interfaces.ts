import type {
  CoachResponse,
  InteractionRecord,
  ProblemContext,
  SubmissionContext,
} from '../types/ai.types.js';

/**
 * Ports. The AI Coach service depends on these abstractions, never on
 * the Gemini SDK, Prisma, or ioredis directly — so the LLM is swappable
 * (Gemini today, anything tomorrow), the whole pipeline is testable with
 * a fake LLM (essential, since we can't call Gemini in CI), and the
 * grounding data comes from the assumed Problem/Submission services
 * behind one clean boundary.
 */

/** The LLM boundary. A structured JSON request in, structured text out. */
export interface ILLMClient {
  complete(input: LLMRequest): Promise<LLMResult>;
}

export interface LLMRequest {
  system: string;
  user: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  /** JSON schema the model must conform to (structured output) */
  responseSchema?: unknown;
}

export interface LLMResult {
  text: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  /** true if the provider blocked the response for safety */
  blocked?: boolean;
}

/** Grounding sources (the assumed Problem + Submission/History services). */
export interface IProblemContextProvider {
  getProblem(problemId: string): Promise<ProblemContext | null>;
}

export interface ISubmissionContextProvider {
  getLatestSubmission(userId: string, problemId: string): Promise<SubmissionContext | null>;
  getWeakTopics(userId: string): Promise<string[]>;
  getSolvedTopics(userId: string): Promise<string[]>;
  /** candidate next problems by topic, for recommendation mode */
  suggestProblems(
    userId: string,
    topics: string[],
    limit: number,
  ): Promise<{ problemId: string; title: string; topic: string }[]>;
}

/** Redis cache for responses + prompts, with hit metrics. */
export interface IPromptCache {
  getResponse(key: string): Promise<CoachResponse | null>;
  setResponse(key: string, value: CoachResponse): Promise<void>;
  recordHit(): Promise<void>;
  recordMiss(): Promise<void>;
  hitRatio(): Promise<{ hits: number; misses: number; ratio: number }>;
}

/** Interaction history (Redis-backed capped list). */
export interface IAiInteractionRepository {
  append(userId: string, record: InteractionRecord): Promise<void>;
  list(userId: string, limit: number): Promise<InteractionRecord[]>;
}

export interface IRateLimiter {
  hit(key: string, windowMs: number, max: number): Promise<boolean>;
}

/** Input/output moderation (content policy). */
export interface IContentModerator {
  isAllowed(text: string): { allowed: boolean; reason?: string };
}
