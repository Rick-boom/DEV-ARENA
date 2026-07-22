/**
 * Collaborative editing domain types.
 *
 * ── CRDT primer (why the types look the way they do) ────────────────
 * A CRDT (Conflict-free Replicated Data Type) is a data structure that
 * every peer can mutate locally and independently, such that when all
 * updates are eventually exchanged, every peer converges to the SAME
 * state — with no central server arbitrating order. Yjs implements a
 * text CRDT (YATA): each inserted character becomes an immutable item
 * with a unique id (client, clock) and links to the item it was
 * inserted after. Concurrent inserts at the "same" spot are ordered
 * deterministically by those ids, so two people typing at once merge
 * without a conflict and without losing keystrokes.
 *
 * These types are the transport + presence contract around that core.
 */

/** The three DevArena room kinds share one editor with different policy. */
export const RoomType = {
  BATTLE: 'battle',
  COLLABORATION: 'collaboration',
  INTERVIEW: 'interview',
} as const;
export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export const PresenceStatus = {
  ACTIVE: 'active',
  IDLE: 'idle',
} as const;
export type PresenceStatus = (typeof PresenceStatus)[keyof typeof PresenceStatus];

/** Identity of a collaborator, supplied by the (assumed) auth layer. */
export interface CollaboratorIdentity {
  userId: string;
  username: string;
  avatarUrl?: string;
  /** deterministic per-user color for cursors/selections */
  color: string;
}

/** A remote user's live editor state, carried over Awareness (not the doc). */
export interface AwarenessUserState {
  user: CollaboratorIdentity;
  status: PresenceStatus;
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
  language: string;
  file: string;
  lastActive: number;
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Wire envelope for Yjs sync + awareness over Socket.IO. Yjs updates
 * are binary (Uint8Array); Socket.IO carries them as ArrayBuffer. The
 * `type` discriminates the y-protocols message kind so the provider
 * routes it to sync vs awareness handling.
 */
export const CollabMessageType = {
  SYNC: 'collab:sync',
  AWARENESS: 'collab:awareness',
  AUTH_DENIED: 'collab:auth-denied',
} as const;
export type CollabMessageType = (typeof CollabMessageType)[keyof typeof CollabMessageType];

export interface CollabMessage {
  room: string;
  /** binary Yjs / awareness payload */
  payload: ArrayBuffer;
}

/** Connection lifecycle the provider exposes to the UI. */
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SYNCED: 'synced',
} as const;
export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

/**
 * The minimal Socket.IO surface this module depends on. We DON'T import
 * socket.io-client's concrete type — the prompt says the socket server
 * already exists — so we depend on this structural port and accept any
 * compatible socket. This keeps the collab engine decoupled and testable
 * with a fake socket.
 */
export interface CollabSocket {
  emit(event: string, ...args: unknown[]): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener?: (...args: unknown[]) => void): void;
  get connected(): boolean;
}
