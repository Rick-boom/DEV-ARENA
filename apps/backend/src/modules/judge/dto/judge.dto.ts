import type { z } from 'zod';
import type {
  createSubmissionSchema,
  historyQuerySchema,
  resultQuerySchema,
  submissionIdSchema,
} from '../validators/judge.schemas.js';

export type CreateSubmissionDto = z.infer<typeof createSubmissionSchema>;
export type SubmissionIdDto = z.infer<typeof submissionIdSchema>;
export type HistoryQueryDto = z.infer<typeof historyQuerySchema>;
export type ResultQueryDto = z.infer<typeof resultQuerySchema>;
