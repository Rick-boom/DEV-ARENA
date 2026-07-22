import { z } from 'zod';
import { Language } from '@prisma/client';

/** Validation boundary for every judge endpoint. */
export const createSubmissionSchema = z.object({
  problemId: z.string().uuid(),
  language: z.nativeEnum(Language),
  code: z.string().min(1, 'Code cannot be empty').max(64_000, 'Code is too large'),
  battleId: z.string().uuid().optional(),
});

export const submissionIdSchema = z.object({
  id: z.string().uuid(),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const resultQuerySchema = z.object({
  submissionId: z.string().uuid(),
});
