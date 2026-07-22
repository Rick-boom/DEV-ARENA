/**
 * Public API of the DevArena collaborative editing engine.
 * Everything a feature needs to add real-time collaboration to a Monaco
 * editor is exported here; internals stay encapsulated.
 */
export { CollaborationSession } from './collaboration-session.js';
export type { CollaborationSessionOptions } from './collaboration-session.js';
export { SocketIOProvider } from './providers/socket-io-provider.js';
export { OfflineStore, IndexedDbStore } from './providers/offline-store.js';
export type { KeyValueStore } from './providers/offline-store.js';
export { AwarenessManager } from './awareness/awareness-manager.js';
export { RemoteCursorRenderer } from './cursor/remote-cursors.js';
export { CollaborativeUndoManager } from './sync/undo-manager.js';
export { ReconnectManager } from './sync/reconnect-manager.js';
export { VersionRecovery } from './sync/version-recovery.js';
export type { NamedSnapshot } from './sync/version-recovery.js';
export { bindMonaco } from './bindings/monaco-binding.js';
export { colorForUser, selectionColor } from './utils/color.js';

export { useCollaborationSession } from './hooks/useCollaborationSession.js';
export { useMonacoCollaboration } from './hooks/useMonacoCollaboration.js';
export { usePresence } from './hooks/usePresence.js';

export * from './types/collab.types.js';
export * from './errors/collab-errors.js';
