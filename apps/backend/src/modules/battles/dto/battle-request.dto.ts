import type { z } from 'zod';
import type {
  battleActionSchema,
  createBattleSchema,
  finishBattleSchema,
  historyQuerySchema,
  joinBattleSchema,
  rematchSchema,
} from '../validators/battle.schemas.js';

export type CreateBattleDto = z.infer<typeof createBattleSchema>;
export type JoinBattleDto = z.infer<typeof joinBattleSchema>;
export type BattleActionDto = z.infer<typeof battleActionSchema>;
export type FinishBattleDto = z.infer<typeof finishBattleSchema>;
export type RematchDto = z.infer<typeof rematchSchema>;
export type HistoryQueryDto = z.infer<typeof historyQuerySchema>;
