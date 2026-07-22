import { z } from 'zod';
import { Difficulty, Language, ProblemVisibility } from '@prisma/client';
import { PROBLEM_CONSTANTS } from '../constants/problem.constants.js';
import { SORT_OPTIONS } from '../types/problem.types.js';

/**
 * Zod schemas = the single validation boundary. Everything past a
 * validator is trusted, typed data. Coercion lives here (page numbers
 * arrive as strings), and enum checks produce the InvalidDifficulty-
 * class errors the spec requires — as 422s with field details.
 */

const { PAGINATION, LIMITS } = PROBLEM_CONSTANTS;

const slugSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (a-z, 0-9, hyphens)');

const csvToArray = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')))
  .transform((arr) => arr.map((s) => s.trim().toLowerCase()).filter(Boolean));

const boolFromQuery = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

export const problemIdParamSchema = z.object({
  id: z.string().min(1).max(128), // uuid OR slug — repository resolves both
});

export const listProblemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
  sortBy: z.enum(SORT_OPTIONS).default('newest'),
  difficulty: z.nativeEnum(Difficulty).optional(),
  tags: csvToArray.optional(),
  companies: csvToArray.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  solved: boolFromQuery.optional(),
  bookmarked: boolFromQuery.optional(),
});

export const searchProblemsQuerySchema = listProblemsQuerySchema.extend({
  q: z.string().trim().min(1, 'Search keyword is required').max(100),
});

const exampleSchema = z.object({
  input: z.string().min(1).max(10_000),
  output: z.string().min(1).max(10_000),
  explanation: z.string().max(10_000).optional(),
});

const constraintSchema = z.string().min(1).max(500);
const hintSchema = z.string().min(1).max(5_000);

export const createProblemBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: slugSchema.optional(), // generated from title when omitted
  statement: z.string().min(20),
  difficulty: z.nativeEnum(Difficulty),
  visibility: z.nativeEnum(ProblemVisibility).default(ProblemVisibility.DRAFT),
  timeLimitMs: z.number().int().min(100).max(20_000).default(2000),
  memoryLimitMb: z.number().int().min(16).max(1024).default(256),
  tags: z.array(slugSchema).max(LIMITS.MAX_TAGS_PER_PROBLEM).default([]),
  companies: z.array(slugSchema).max(LIMITS.MAX_COMPANIES_PER_PROBLEM).default([]),
  examples: z.array(exampleSchema).min(1).max(LIMITS.MAX_EXAMPLES),
  constraints: z.array(constraintSchema).max(50).default([]),
  hints: z.array(hintSchema).max(LIMITS.MAX_HINTS).default([]),
});

export const updateProblemBodySchema = createProblemBodySchema
  .partial()
  .extend({
    /** Optimistic lock: client sends the version it edited. */
    expectedVersion: z.number().int().min(1),
  })
  .refine((body) => Object.keys(body).length > 1, {
    message: 'At least one field besides expectedVersion must be provided',
  });

export const uploadTestCasesBodySchema = z.object({
  mode: z.enum(['replace']).default('replace'),
  testCases: z
    .array(
      z.object({
        input: z.string().min(1).max(1_000_000),
        expectedOutput: z.string().min(1).max(1_000_000),
        isHidden: z.boolean().default(true),
        weight: z.number().int().min(1).max(100).default(1),
      }),
    )
    .min(1)
    .max(LIMITS.MAX_TEST_CASES_PER_UPLOAD),
});

export const upsertEditorialBodySchema = z.object({
  content: z.string().min(20),
  timeComplexity: z.string().max(64).optional(),
  spaceComplexity: z.string().max(64).optional(),
});

export const upsertHintsBodySchema = z.object({
  hints: z.array(hintSchema).min(1).max(LIMITS.MAX_HINTS),
});

export const upsertTagBodySchema = z.object({
  name: z.string().trim().min(2).max(64),
});

export const upsertCompanyBodySchema = z.object({
  name: z.string().trim().min(2).max(64),
  logoUrl: z.string().url().max(512).optional(),
});

export const versionParamSchema = z.object({
  id: z.string().min(1).max(128),
  version: z.coerce.number().int().min(1),
});

/** Language starter-template validation (multi-language support). */
export const languageSchema = z.nativeEnum(Language);
