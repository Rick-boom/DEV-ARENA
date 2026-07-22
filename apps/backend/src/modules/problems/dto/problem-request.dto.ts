import type { z } from 'zod';
import type {
  createProblemBodySchema,
  listProblemsQuerySchema,
  searchProblemsQuerySchema,
  updateProblemBodySchema,
  uploadTestCasesBodySchema,
  upsertCompanyBodySchema,
  upsertEditorialBodySchema,
  upsertHintsBodySchema,
  upsertTagBodySchema,
} from '../validators/problem.schemas.js';

/**
 * Request DTOs — inferred from the Zod schemas so validation and
 * types can never drift apart. Controllers/services accept these,
 * never raw Express request parts.
 */
export type ListProblemsQueryDto = z.infer<typeof listProblemsQuerySchema>;
export type SearchProblemsQueryDto = z.infer<typeof searchProblemsQuerySchema>;
export type CreateProblemDto = z.infer<typeof createProblemBodySchema>;
export type UpdateProblemDto = z.infer<typeof updateProblemBodySchema>;
export type UploadTestCasesDto = z.infer<typeof uploadTestCasesBodySchema>;
export type UpsertEditorialDto = z.infer<typeof upsertEditorialBodySchema>;
export type UpsertHintsDto = z.infer<typeof upsertHintsBodySchema>;
export type UpsertTagDto = z.infer<typeof upsertTagBodySchema>;
export type UpsertCompanyDto = z.infer<typeof upsertCompanyBodySchema>;
