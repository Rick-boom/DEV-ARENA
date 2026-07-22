import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { SocketIOProvider } from './providers/socket-io-provider.js';
import { OfflineStore, type KeyValueStore } from './providers/offline-store.js';
import { AwarenessManager } from './awareness/awareness-manager.js';
import { ReconnectManager } from './sync/reconnect-manager.js';
import { VersionRecovery } from './sync/version-recovery.js';
import { colorForUser } from './utils/color.js';
import type { ConnectionState } from './types/collab.types.js';
import {
  type CollaboratorIdentity,
  type CollabSocket,
  type RoomType,
} from './types/collab.types.js';

/**
 * Composition root for one collaborative document. It wires the CRDT
 * (Y.Doc), the transport (SocketIOProvider), presence (AwarenessManager),
 * offline persistence (OfflineStore), resync (ReconnectManager), and
 * history (VersionRecovery) into a single object the UI drives. Every
 * collaborator concern is a separate injected piece (SOLID): the session
 * only orchestrates their lifecycle.
 *
 * The single shared Y.Doc IS the source of truth. Everything else —
 * Monaco, React state, remote cursors — is a projection of it.
 */
export interface CollaborationSessionOptions {
  roomName: string;
  roomType: RoomType;
  identity: Omit<CollaboratorIdentity, 'color'> & { color?: string };
  socket: CollabSocket;
  /** default field name for the code text */
  textField?: string;
  language?: string;
  file?: string;
  /** offline persistence backend; omit to disable offline support */
  offlineStore?: KeyValueStore;
  /** enable history retention for version recovery (disables gc) */
  enableVersionRecovery?: boolean;
}

export class CollaborationSession {
  readonly doc: Y.Doc;
  readonly text: Y.Text;
  readonly awarenessManager: AwarenessManager;
  readonly awareness: Awareness;
  readonly provider: SocketIOProvider;
  readonly recovery: VersionRecovery | null;

  private readonly reconnect: ReconnectManager;
  private readonly offline: OfflineStore | null;
  private readonly textField: string;

  constructor(private readonly options: CollaborationSessionOptions) {
    this.textField = options.textField ?? 'monaco';
    // gc off only when we need history; otherwise let Yjs reclaim tombstones.
    this.doc = new Y.Doc({ gc: !options.enableVersionRecovery });
    this.text = this.doc.getText(this.textField);
    this.awareness = new Awareness(this.doc);

    const identity: CollaboratorIdentity = {
      ...options.identity,
      color: options.identity.color ?? colorForUser(options.identity.userId),
    };
    this.awarenessManager = new AwarenessManager(this.awareness, identity);

    this.provider = new SocketIOProvider(
      options.roomName,
      this.doc,
      options.socket,
      this.awareness,
    );
    this.reconnect = new ReconnectManager(options.socket, this.provider);
    this.offline = options.offlineStore
      ? new OfflineStore(this.doc, options.offlineStore, options.roomName)
      : null;
    this.recovery = options.enableVersionRecovery ? new VersionRecovery(this.doc) : null;
  }

  /** Load offline state (if any) and publish initial presence. */
  async start(): Promise<void> {
    if (this.offline) await this.offline.whenReady();
    this.awarenessManager.init(this.options.language ?? 'javascript', this.options.file ?? 'main');
  }

  get connectionState(): ConnectionState {
    return this.provider.state;
  }

  onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    const handler = (s: ConnectionState): void => listener(s);
    this.provider.on('status', handler);
    return () => this.provider.off('status', handler);
  }

  destroy(): void {
    this.awarenessManager.destroy();
    this.reconnect.destroy();
    this.offline?.destroy();
    this.provider.destroy();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
