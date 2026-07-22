import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../types/execution.types.js';
import { env } from '../config/env.js';

/**
 * The single validation boundary for /execute. Past this schema the
 * data is trusted and typed. Code size is capped to keep payloads
 * (and therefore attack surface + queue memory) bounded.
 */
export const executeRequestSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, {
    errorMap: () => ({ message: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` }),
  }),
  code: z.string().min(1, 'code is required').max(64_000, 'code exceeds 64KB limit'),
  input: z.string().max(1_000_000, 'input exceeds 1MB limit').optional().default(''),
  timeLimitMs: z.coerce.number().int().min(100).max(env.MAX_EXECUTION_MS).optional(),
  memoryLimitMb: z.coerce.number().int().min(16).max(env.MAX_MEMORY_MB).optional(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
});

export type ExecuteRequestInput = z.infer<typeof executeRequestSchema>;
