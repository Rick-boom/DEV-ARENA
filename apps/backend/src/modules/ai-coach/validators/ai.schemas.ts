import { z } from 'zod';
import { AI_CONSTANTS } from '../constants/ai.constants.js';

/** One validation boundary for every AI endpoint. */
const languageSchema = z.enum(AI_CONSTANTS.SUPPORTED_LANGUAGES);
const codeSchema = z.string().max(AI_CONSTANTS.LIMITS.MAX_CODE_CHARS).optional();
const questionSchema = z.string().trim().max(1000).optional();
const problemId = z.string().uuid();

export const hintSchema = z.object({
  problemId,
  code: codeSchema,
  language: languageSchema.optional(),
  question: questionSchema,
});

export const reviewSchema = z.object({
  problemId,
  code: z.string().min(1).max(AI_CONSTANTS.LIMITS.MAX_CODE_CHARS),
  language: languageSchema,
  question: questionSchema,
});

export const complexitySchema = reviewSchema;

export const interviewSchema = z.object({
  problemId,
  code: codeSchema,
  language: languageSchema.optional(),
  question: questionSchema,
});

export const recommendSchema = z.object({
  problemId,
});

export const learningSchema = z.object({
  problemId,
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
