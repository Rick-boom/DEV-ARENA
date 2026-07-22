import { z } from 'zod';
import { BattleMode } from '@prisma/client';
import { BattleType } from '../types/battle.types.js';
import { BATTLE_CONSTANTS } from '../constants/battle.constants.js';

/** Single validation boundary for every battle endpoint. */
export const createBattleSchema = z.object({
  type: z.nativeEnum(BattleType).default(BattleType.ONE_VS_ONE),
  mode: z.nativeEnum(BattleMode).default(BattleMode.ONE_VS_ONE),
  problemId: z.string().uuid().optional(), // omitted → assigned at start
  rated: z.boolean().default(true),
  isPrivate: z.boolean().default(false),
  name: z.string().trim().min(1).max(100).default('Untitled Battle'),
  capacity: z
    .number()
    .int()
    .min(2)
    .max(BATTLE_CONSTANTS.ROOM.MAX_CAPACITY)
    .default(BATTLE_CONSTANTS.ROOM.DEFAULT_CAPACITY),
  durationMs: z
    .number()
    .int()
    .min(60_000)
    .max(4 * 3600_000)
    .optional(),
});

export const joinBattleSchema = z
  .object({
    battleId: z.string().uuid().optional(),
    code: z.string().length(BATTLE_CONSTANTS.ROOM.CODE_LENGTH).optional(),
    inviteToken: z.string().min(8).max(128).optional(),
  })
  .refine((v) => v.battleId ?? v.code ?? v.inviteToken, {
    message: 'One of battleId, code, or inviteToken is required',
  });

export const battleIdParamSchema = z.object({ id: z.string().uuid() });

export const battleActionSchema = z.object({
  battleId: z.string().uuid(),
  /** monotonic per-user nonce → replay protection on lifecycle actions */
  nonce: z.number().int().min(1),
});

export const finishBattleSchema = battleActionSchema.extend({
  /** optional forced winner (host abort-to-winner); else engine decides */
  winnerId: z.string().uuid().optional(),
});

export const rematchSchema = z.object({ battleId: z.string().uuid() });

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const replayQuerySchema = z.object({ id: z.string().uuid() });
