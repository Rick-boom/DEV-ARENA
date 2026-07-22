import type { Awareness } from 'y-protocols/awareness';
import {
  PresenceStatus,
  type AwarenessUserState,
  type CollaboratorIdentity,
  type CursorPosition,
  type SelectionRange,
} from '../types/collab.types.js';

/**
 * ── Awareness: the ephemeral CRDT sibling ───────────────────────────
 * Awareness holds state that should NOT live in the document: who's
 * here, where their cursor is, what they've selected, whether they're
 * idle. It's a per-client last-write-wins map with an automatic timeout,
 * so when a peer disconnects their entry expires and their cursor
 * vanishes — exactly what you want for presence (unlike document text,
 * which must persist).
 *
 * This manager wraps the raw Awareness protocol in a typed, intention-
 * revealing API and owns the idle detection. It never touches the Y.Doc,
 * keeping presence concerns cleanly separated from document concerns.
 */
export class AwarenessManager {
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly awareness: Awareness,
    private readonly identity: CollaboratorIdentity,
    private readonly idleAfterMs = 60_000,
  ) {}

  /** Publish the initial presence entry for the local user. */
  init(language: string, file: string): void {
    const state: AwarenessUserState = {
      user: this.identity,
      status: PresenceStatus.ACTIVE,
      cursor: null,
      selection: null,
      language,
      file,
      lastActive: Date.now(),
    };
    this.awareness.setLocalState(state);
    this.bumpActivity();
  }

  private patch(partial: Partial<AwarenessUserState>): void {
    const current = this.awareness.getLocalState() as AwarenessUserState | null;
    if (!current) return;
    this.awareness.setLocalState({ ...current, ...partial, lastActive: Date.now() });
  }

  setCursor(cursor: CursorPosition | null): void {
    this.patch({ cursor });
    this.bumpActivity();
  }

  setSelection(selection: SelectionRange | null): void {
    this.patch({ selection });
    this.bumpActivity();
  }

  setLanguage(language: string): void {
    this.patch({ language });
  }

  setFile(file: string): void {
    this.patch({ file });
  }

  /** Any local activity resets the idle countdown. */
  private bumpActivity(): void {
    this.patch({ status: PresenceStatus.ACTIVE });
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(
      () => this.patch({ status: PresenceStatus.IDLE }),
      this.idleAfterMs,
    );
  }

  /** All remote collaborators (everyone except us), typed. */
  getRemoteStates(): Map<number, AwarenessUserState> {
    const result = new Map<number, AwarenessUserState>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === this.awareness.clientID) continue;
      if (state && (state as AwarenessUserState).user) {
        result.set(clientId, state as AwarenessUserState);
      }
    }
    return result;
  }

  /** Subscribe to presence changes; returns an unsubscribe fn. */
  onChange(listener: (states: Map<number, AwarenessUserState>) => void): () => void {
    const handler = (): void => listener(this.getRemoteStates());
    this.awareness.on('change', handler);
    return () => this.awareness.off('change', handler);
  }

  destroy(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.awareness.setLocalState(null);
  }
}
