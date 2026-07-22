import { z } from 'zod';
import { RoomType } from '../types/domain.types.js';

/**
 * Payload schemas for inbound events. Even on an authenticated socket
 * the PAYLOAD is untrusted, so every mutating event validates its
 * shape before the handler runs — a malformed roomId or a cursor with
 * a negative line never reaches a manager.
 */
export const roomIdSchema = z.string().min(1).max(128);

export const createRoomSchema = z.object({
  type: z.nativeEnum(RoomType),
  roomId: z.string().min(1).max(128).optional(),
});

export const joinRoomSchema = z.object({ roomId: roomIdSchema });
export const leaveRoomSchema = z.object({ roomId: roomIdSchema });
export const deleteRoomSchema = z.object({ roomId: roomIdSchema });
export const transferOwnershipSchema = z.object({
  roomId: roomIdSchema,
  toUserId: z.string().min(1).max(128),
});

export const presenceUpdateSchema = z.object({
  roomId: roomIdSchema,
  focused: z.boolean().optional(),
  state: z.enum(['online', 'idle', 'offline']).optional(),
});

export const typingSchema = z.object({ roomId: roomIdSchema });

export const cursorUpdateSchema = z.object({
  roomId: roomIdSchema,
  cursor: z.object({
    line: z.number().int().min(0).max(1_000_000),
    column: z.number().int().min(0).max(100_000),
  }),
  nonce: z.number().int().min(1),
});
