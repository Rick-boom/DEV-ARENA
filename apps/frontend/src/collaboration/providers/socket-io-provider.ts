import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import {
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { ObservableV2 } from 'lib0/observable';
import { ConnectionState, type CollabSocket } from '../types/collab.types.js';
import { ConnectionLostError, SyncFailureError } from '../errors/collab-errors.js';

/**
 * ── Why a custom provider instead of y-websocket ────────────────────
 * y-websocket ships its own WebSocket server. The prompt says the
 * Socket.IO infrastructure ALREADY EXISTS, so we must speak Yjs over
 * that existing socket rather than open a second connection. This
 * provider re-implements the y-websocket wire protocol (the y-protocols
 * `sync` + `awareness` message types) on top of an injected CollabSocket.
 *
 * ── The sync protocol (two steps) ───────────────────────────────────
 * Yjs sync is a state-based CRDT exchange:
 *   • SyncStep1: a peer sends its "state vector" — a compact summary of
 *     how many updates it has seen from each client. It says "here's
 *     what I already have."
 *   • SyncStep2: the other side replies with exactly the updates the
 *     first peer is MISSING (a diff), computed from that state vector.
 * Because updates are commutative and idempotent in a CRDT, it doesn't
 * matter what order they arrive or if some arrive twice — applying them
 * always converges. That property is what makes offline edits and
 * reconnect-resync "just work": on reconnect we simply re-run SyncStep1,
 * and the server streams whatever we missed while away.
 *
 * ── Awareness (ephemeral, not in the doc) ───────────────────────────
 * Cursors, selections, and presence are NOT part of the document CRDT —
 * they're transient and should vanish when a user leaves. They travel on
 * the separate Awareness protocol, which is last-write-wins per client
 * with a heartbeat/timeout, so a disconnected user's cursor disappears.
 */

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface ProviderEvents {
  status: (state: ConnectionState) => void;
  synced: (isSynced: boolean) => void;
  error: (err: Error) => void;
}

export interface SocketIOProviderOptions {
  /** binary event name used on the socket for this module */
  syncEvent?: string;
  /** whether to connect immediately (default true) */
  connect?: boolean;
}

export class SocketIOProvider extends ObservableV2<ProviderEvents> {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly roomName: string;

  private readonly socket: CollabSocket;
  private readonly syncEvent: string;
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private _synced = false;
  private disposed = false;

  constructor(
    roomName: string,
    doc: Y.Doc,
    socket: CollabSocket,
    awareness: Awareness,
    options: SocketIOProviderOptions = {},
  ) {
    super();
    this.roomName = roomName;
    this.doc = doc;
    this.socket = socket;
    this.awareness = awareness;
    this.syncEvent = options.syncEvent ?? `collab:${roomName}`;

    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
    this.socket.on(this.syncEvent, this.handleMessage);
    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);

    // Clean our awareness entry out on tab close.
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleUnload);
    }

    if (options.connect !== false && this.socket.connected) {
      this.handleConnect();
    }
  }

  get state(): ConnectionState {
    return this._state;
  }
  get synced(): boolean {
    return this._synced;
  }

  private setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit('status', [state]);
  }

  private setSynced(synced: boolean): void {
    if (this._synced === synced) return;
    this._synced = synced;
    this.emit('synced', [synced]);
    if (synced) this.setState(ConnectionState.SYNCED);
  }

  // ── connection lifecycle ───────────────────────────────────────
  private handleConnect = (): void => {
    this.setState(ConnectionState.CONNECTED);
    // Kick off SyncStep1: announce our state vector, ask for the diff.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.send(encoding.toUint8Array(encoder));

    // Broadcast our initial awareness (presence + cursor) if we have any.
    if (this.awareness.getLocalState() !== null) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
      this.send(encoding.toUint8Array(enc));
    }
  };

  private handleDisconnect = (): void => {
    this.setSynced(false);
    this.setState(ConnectionState.DISCONNECTED);
    // Drop remote awareness states — their cursors shouldn't linger while
    // we're offline; they'll re-broadcast on reconnect.
    removeAwarenessStates(
      this.awareness,
      Array.from(this.awareness.getStates().keys()).filter((id) => id !== this.doc.clientID),
      'disconnect',
    );
    this.emit('error', [new ConnectionLostError()]);
  };

  // ── inbound messages ───────────────────────────────────────────
  private handleMessage = (...args: unknown[]): void => {
    if (this.disposed) return;
    try {
      const raw = args[0];
      const bytes = toUint8Array(raw);
      if (!bytes) return;
      const decoder = decoding.createDecoder(bytes);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
        // A reply was produced (e.g. SyncStep2 answering a peer's Step1).
        if (encoding.length(encoder) > 1) {
          this.send(encoding.toUint8Array(encoder));
        }
        // Receiving SyncStep2 (the diff) means our doc is now caught up.
        if (syncMessageType === syncProtocol.messageYjsSyncStep2 && !this._synced) {
          this.setSynced(true);
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
      }
    } catch (err) {
      this.emit('error', [new SyncFailureError((err as Error).message)]);
    }
  };

  // ── outbound: local doc + awareness changes ────────────────────
  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    // Don't echo updates that came FROM the network back to it.
    if (origin === this) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.send(encoding.toUint8Array(encoder));
  };

  private handleAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin === this) return;
    const changedClients = [...changes.added, ...changes.updated, ...changes.removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, changedClients));
    this.send(encoding.toUint8Array(encoder));
  };

  private send(bytes: Uint8Array): void {
    if (!this.socket.connected) return;
    // Send the underlying ArrayBuffer so Socket.IO frames it as binary.
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    this.socket.emit(this.syncEvent, buffer);
  }

  private handleUnload = (): void => {
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'unload');
  };

  /** Force a resync (used by the reconnect flow). */
  resync(): void {
    if (this.socket.connected) this.handleConnect();
  }

  override destroy(): void {
    this.disposed = true;
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    this.socket.off(this.syncEvent, this.handleMessage);
    this.socket.off('connect', this.handleConnect);
    this.socket.off('disconnect', this.handleDisconnect);
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleUnload);
    }
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy');
    super.destroy();
  }
}

/** Normalize whatever the socket handed us into a Uint8Array. */
function toUint8Array(raw: unknown): Uint8Array | null {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  return null;
}
