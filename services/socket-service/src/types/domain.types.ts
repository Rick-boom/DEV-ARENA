/**
 * Domain vocabulary for the real-time layer. Kept as const objects
 * (not TS enums) so they erase cleanly and serialize as plain strings
 * over the wire and into Redis.
 */

export const RoomType = {
  BATTLE: 'battle',
  COLLABORATION: 'collaboration',
  INTERVIEW: 'interview',
} as const;
export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export const PresenceState = {
  ONLINE: 'online',
  IDLE: 'idle',
  OFFLINE: 'offline',
} as const;
export type PresenceState = (typeof PresenceState)[keyof typeof PresenceState];

/** Identity attached to every authenticated socket (from the JWT). */
export interface AuthUser {
  id: string;
  role: string;
  username: string;
}

/** A participant as seen by others in the room. */
export interface Participant {
  userId: string;
  username: string;
  role: string;
  state: PresenceState;
  typing: boolean;
  focused: boolean;
  cursor: CursorPosition | null;
  joinedAt: number;
}

export interface CursorPosition {
  line: number;
  column: number;
}

/** Authoritative room record (persisted in Redis, shared across nodes). */
export interface Room {
  id: string;
  type: RoomType;
  ownerId: string;
  capacity: number;
  createdAt: number;
  /** userIds currently considered members (survives brief disconnects) */
  memberIds: string[];
}
