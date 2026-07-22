import { randomUUID } from 'node:crypto';
import { AI_CONSTANTS } from '../constants/ai.constants.js';
import {
  AIUnavailableError,
  ContentBlockedError,
  PromptInjectionError,
  RateLimitExceededError,
} from '../errors/ai-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { Redis } from 'ioredis';
import { detectInjection } from '../context/injection-guard.js';
import type { ContextBuilder } from '../context/context-builder.js';
import type { PromptBuilder } from '../prompts/prompt-builder.js';
import type { ResponseValidator } from '../validation/response-validator.js';
import {
  AiMode,
  type CoachRequest,
  type CoachResponse,
  type InteractionRecord,
} from '../types/ai.types.js';
import type {
  IAiInteractionRepository,
  IContentModerator,
  ILLMClient,
  IPromptCache,
  IRateLimiter,
  ISubmissionContextProvider,
} from '../interfaces/ai.interfaces.js';

const log = createModuleLogger('ai-coach-service');
const { KEYS, RATE_LIMIT, LIMITS } = AI_CONSTANTS;

/**
 * The orchestrator. It implements the exact pipeline from the spec:
 *
 *   validate + moderate + injection-guard
 *     → Context Builder → Prompt Builder → [cache check]
 *     → Gemini → Response Validator → cache + persist → return.
 *
 * Every external concern is an injected port (SOLID / DI), so this class
 * holds only orchestration + policy. Failures degrade gracefully: the
 * cache is best-effort, and an LLM outage surfaces as AIUnavailable
 * rather than a crash.
 */
export class AiCoachService {
  constructor(
    private readonly context: ContextBuilder,
    private readonly promptBuilder: PromptBuilder,
    private readonly validator: ResponseValidator,
    private readonly llm: ILLMClient,
    private readonly cache: IPromptCache,
    private readonly history: IAiInteractionRepository,
    private readonly rateLimiter: IRateLimiter,
    private readonly moderator: IContentModerator,
    private readonly submissions: ISubmissionContextProvider,
    private readonly redis: Redis,
  ) {}

  async coach(req: CoachRequest): Promise<CoachResponse> {
    const started = Date.now();

    // ── 1. rate limit (per user) ───────────────────────────────────
    const allowed = await this.rateLimiter.hit(
      KEYS.rate(req.userId),
      RATE_LIMIT.WINDOW_MS,
      RATE_LIMIT.MAX_PER_MINUTE,
    );
    if (!allowed) throw new RateLimitExceededError();

    // ── 2. moderate + injection-guard the untrusted free-text ──────
    if (req.question) {
      const mod = this.moderator.isAllowed(req.question);
      if (!mod.allowed) throw new ContentBlockedError();
      if (detectInjection(req.question).injected) throw new PromptInjectionError();
    }

    // ── 3. build grounded context ──────────────────────────────────
    const { ctx } = await this.context.build(req);

    // ── 4. hint ladder: escalate the level per (user, problem) ─────
    let hintLevel: number | undefined;
    if (req.mode === AiMode.HINT) {
      hintLevel = await this.nextHintLevel(req.userId, req.problemId);
    }

    // ── 5. recommendation candidates (grounded, no invented ids) ───
    let candidates: { problemId: string; title: string; topic: string }[] | undefined;
    if (req.mode === AiMode.RECOMMENDATION) {
      candidates = await this.submissions.suggestProblems(req.userId, ctx.weakTopics ?? [], 8);
    }

    // ── 6. build prompt + cache key ────────────────────────────────
    const { request, cacheKey } = this.promptBuilder.build(req.mode, ctx, {
      question: req.question,
      hintLevel,
      candidates,
    });

    // ── 7. cache check ─────────────────────────────────────────────
    const cached = await this.cache.getResponse(cacheKey);
    if (cached) {
      await this.cache.recordHit();
      const response = {
        ...cached,
        meta: { ...cached.meta, cached: true, latencyMs: Date.now() - started },
      };
      await this.record(req, response);
      return response;
    }
    await this.cache.recordMiss();

    // ── 8. call the model ──────────────────────────────────────────
    let result;
    try {
      result = await this.llm.complete(request);
    } catch (err) {
      log.error({ err, mode: req.mode }, 'llm call failed');
      throw err instanceof AIUnavailableError ? err : new AIUnavailableError();
    }
    if (result.blocked) throw new ContentBlockedError();

    // ── 9. validate the OUTPUT (anti-leak) ─────────────────────────
    const response = this.validator.parseAndValidate(result.text, req.mode, ctx);
    response.hintLevel = hintLevel ?? response.hintLevel;
    response.meta = {
      cached: false,
      model: result.model,
      latencyMs: Date.now() - started,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    };

    // ── 10. cache + persist ────────────────────────────────────────
    await this.cache.setResponse(cacheKey, response);
    await this.record(req, response);

    log.info(
      {
        mode: req.mode,
        problemId: req.problemId,
        latencyMs: response.meta.latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        cached: false,
      },
      'coach response',
    );
    return response;
  }

  async getHistory(userId: string, limit: number): Promise<InteractionRecord[]> {
    return this.history.list(userId, limit);
  }

  async cacheStats(): Promise<{ hits: number; misses: number; ratio: number }> {
    return this.cache.hitRatio();
  }

  // ── helpers ──────────────────────────────────────────────────────
  private async nextHintLevel(userId: string, problemId: string): Promise<number> {
    const key = KEYS.hintLevel(userId, problemId);
    const level = await this.redis.incr(key).catch(() => 1);
    await this.redis.expire(key, 3600).catch(() => undefined);
    return Math.min(level, LIMITS.MAX_HINTS_PER_PROBLEM);
  }

  private async record(req: CoachRequest, response: CoachResponse): Promise<void> {
    const record: InteractionRecord = {
      id: randomUUID(),
      mode: req.mode,
      problemId: req.problemId,
      at: Date.now(),
      cached: response.meta.cached,
      latencyMs: response.meta.latencyMs,
      tokensIn: response.meta.tokensIn,
      tokensOut: response.meta.tokensOut,
      summary: response.summary.slice(0, 200),
    };
    await this.history
      .append(req.userId, record)
      .catch((err) => log.warn({ err }, 'history append failed'));
  }
}
