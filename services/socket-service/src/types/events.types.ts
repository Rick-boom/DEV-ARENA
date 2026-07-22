import type { CursorPosition, Participant, PresenceState, Room, RoomType } from './domain.types.js';

/**
 * The socket event contract, typed end-to-end. Socket.IO is
 * generic over these maps, so both the server handlers and any
 * TypeScript client get compile-time checking of event names AND
 * payloads — a whole class of "wrong payload shape" bugs disappears.
 */

/** Ack envelope returned to callback-style emits. */
export type Ack<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** client → server */
export interface ClientToServerEvents {
  'room:create': (
    payload: { type: RoomType; roomId?: string },
    ack: (res: Ack<{ room: Room }>) => void,
  ) => void;
  'room:join': (
    payload: { roomId: string },
    ack: (res: Ack<{ room: Room; participants: Participant[] }>) => void,
  ) => void;
  'room:leave': (payload: { roomId: string }, ack: (res: Ack<{ left: true }>) => void) => void;
  'room:delete': (payload: { roomId: string }, ack: (res: Ack<{ deleted: true }>) => void) => void;
  'room:transfer-ownership': (
    payload: { roomId: string; toUserId: string },
    ack: (res: Ack<{ room: Room }>) => void,
  ) => void;

  'presence:update': (payload: {
    roomId: string;
    focused?: boolean;
    state?: PresenceState;
  }) => void;
  'typing:start': (payload: { roomId: string }) => void;
  'typing:stop': (payload: { roomId: string }) => void;
  'cursor:update': (payload: { roomId: string; cursor: CursorPosition; nonce: number }) => void;
  heartbeat: (ack: (res: { ts: number }) => void) => void;
}

/** server → client */
export interface ServerToClientEvents {
  'room:user-joined': (payload: { roomId: string; participant: Participant }) => void;
  'room:user-left': (payload: { roomId: string; userId: string }) => void;
  'room:closed': (payload: { roomId: string; reason: string }) => void;
  'room:ownership-changed': (payload: { roomId: string; ownerId: string }) => void;
  'presence:changed': (payload: {
    roomId: string;
    userId: string;
    state: PresenceState;
    focused: boolean;
  }) => void;
  'typing:changed': (payload: { roomId: string; userId: string; typing: boolean }) => void;
  'cursor:changed': (payload: { roomId: string; userId: string; cursor: CursorPosition }) => void;
  error: (payload: { code: string; message: string }) => void;
}

/** cross-node events over the Redis adapter (server ↔ server) */
export interface InterServerEvents {
  ping: () => void;
}

/** per-socket state the server attaches (available on socket.data) */
export interface SocketData {
  user: AuthUserData;
  /** monotonic high-water mark for replay protection, per socket */
  lastNonce: number;
  rateBucket: { windowStart: number; count: number };
}

export interface AuthUserData {
  id: string;
  role: string;
  username: string;
}
