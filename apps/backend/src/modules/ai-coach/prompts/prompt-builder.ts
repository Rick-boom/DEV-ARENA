import { createHash } from 'node:crypto';
import { AI_CONSTANTS } from '../constants/ai.constants.js';
import { PromptTooLargeError } from '../errors/ai-error.js';
import { systemPromptFor } from './system-prompts.js';
import { renderUserPrompt } from './prompt-templates.js';
import { COACH_RESPONSE_SCHEMA } from './response-schema.js';
import type { AiMode, CoachContext } from '../types/ai.types.js';
import type { LLMRequest } from '../interfaces/ai.interfaces.js';

/**
 * Assembles the final LLM request from a mode + grounded context, and
 * derives the cache key. The cache key is a hash of everything that
 * affects the answer (mode + problem + code + verdict + question +
 * hint level) — so identical situations hit the cache and cost nothing,
 * while any change misses and re-asks. This is the core cost lever for
 * 1M requests/month.
 */
export class PromptBuilder {
  build(
    mode: AiMode,
    ctx: CoachContext,
    extra: {
      question?: string;
      hintLevel?: number;
      candidates?: { problemId: string; title: string; topic: string }[];
    },
  ): { request: LLMRequest; cacheKey: string } {
    const system = systemPromptFor(mode);
    const user = renderUserPrompt(mode, ctx, extra);

    const totalChars = system.length + user.length;
    if (totalChars > AI_CONSTANTS.LIMITS.MAX_PROMPT_CHARS) {
      throw new PromptTooLargeError();
    }

    const request: LLMRequest = {
      system,
      user,
      model: AI_CONSTANTS.MODEL.DEFAULT,
      temperature: AI_CONSTANTS.MODEL.TEMPERATURE,
      maxOutputTokens: AI_CONSTANTS.LIMITS.MAX_OUTPUT_TOKENS,
      responseSchema: COACH_RESPONSE_SCHEMA,
    };

    const cacheKey = this.cacheKey(mode, ctx, extra);
    return { request, cacheKey };
  }

  cacheKey(
    mode: AiMode,
    ctx: CoachContext,
    extra: { question?: string; hintLevel?: number },
  ): string {
    const material = JSON.stringify({
      mode,
      problemId: ctx.problem.problemId,
      code: ctx.submission?.code ?? '',
      verdict: ctx.submission?.verdict ?? '',
      question: extra.question ?? '',
      hintLevel: extra.hintLevel ?? 0,
      weak: ctx.weakTopics ?? [],
    });
    return createHash('sha256').update(material).digest('hex').slice(0, 32);
  }
}
