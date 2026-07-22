import type { z } from 'zod';
import type {
  complexitySchema,
  hintSchema,
  historyQuerySchema,
  interviewSchema,
  learningSchema,
  recommendSchema,
  reviewSchema,
} from '../validators/ai.schemas.js';

export type HintDto = z.infer<typeof hintSchema>;
export type ReviewDto = z.infer<typeof reviewSchema>;
export type ComplexityDto = z.infer<typeof complexitySchema>;
export type InterviewDto = z.infer<typeof interviewSchema>;
export type RecommendDto = z.infer<typeof recommendSchema>;
export type LearningDto = z.infer<typeof learningSchema>;
export type HistoryQueryDto = z.infer<typeof historyQuerySchema>;
