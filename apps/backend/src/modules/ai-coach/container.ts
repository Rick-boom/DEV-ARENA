import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Router } from 'express';
import { GeminiClient } from './llm/gemini-client.js';
import { RedisPromptCache } from './cache/prompt-cache.js';
import { RedisRateLimiter } from './cache/redis-rate-limiter.js';
import { RedisAiInteractionRepository } from './repositories/ai-interaction.repository.js';
import {
  PrismaProblemContextProvider,
  PrismaSubmissionContextProvider,
} from './context/prisma-context-providers.js';
import { ContextBuilder } from './context/context-builder.js';
import { PromptBuilder } from './prompts/prompt-builder.js';
import { ResponseValidator } from './validation/response-validator.js';
import { KeywordContentModerator } from './validation/content-moderator.js';
import { AiCoachService } from './services/ai-coach.service.js';
import { AiCoachController } from './controllers/ai-coach.controller.js';
import { buildAiCoachRouter } from './routes/ai-coach.routes.js';
import type { ILLMClient } from './interfaces/ai.interfaces.js';

/**
 * Composition root for the AI Coach. Builds the Gemini client (or accepts
 * an injected LLM for tests/local), the Redis-backed cache/limiter/history,
 * the Prisma grounding providers, and wires the pipeline. Everything below
 * depends on interfaces; only here do concretions meet.
 */
export interface AiCoachModule {
  router: Router;
  service: AiCoachService;
}

export function createAiCoachModule(deps: {
  prisma: PrismaClient;
  redis: Redis;
  geminiApiKey?: string;
  /** inject a fake/alternate LLM (tests, or a different provider) */
  llm?: ILLMClient;
}): AiCoachModule {
  const llm: ILLMClient = deps.llm ?? new GeminiClient({ apiKey: deps.geminiApiKey ?? '' });

  const problems = new PrismaProblemContextProvider(deps.prisma);
  const submissions = new PrismaSubmissionContextProvider(deps.prisma);
  const context = new ContextBuilder(problems, submissions);
  const promptBuilder = new PromptBuilder();
  const validator = new ResponseValidator();
  const cache = new RedisPromptCache(deps.redis);
  const history = new RedisAiInteractionRepository(deps.redis);
  const rateLimiter = new RedisRateLimiter(deps.redis);
  const moderator = new KeywordContentModerator();

  const service = new AiCoachService(
    context,
    promptBuilder,
    validator,
    llm,
    cache,
    history,
    rateLimiter,
    moderator,
    submissions,
    deps.redis,
  );
  const controller = new AiCoachController(service);
  return { router: buildAiCoachRouter(controller), service };
}
