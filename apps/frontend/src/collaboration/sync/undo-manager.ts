import * as Y from 'yjs';

/**
 * ── Collaborative undo/redo ─────────────────────────────────────────
 * Naive undo (revert the last global change) is wrong in collaboration:
 * you'd undo a co-editor's keystroke. Yjs's UndoManager scopes undo to
 * changes ORIGINATING from a set of "tracked origins" — typically just
 * the local user. So Ctrl+Z reverts only YOUR edits, in your own
 * timeline, even as others keep typing. Because the doc is a CRDT, the
 * undo is applied as new operations that merge like any other, so it
 * stays consistent for everyone.
 *
 * We track the local editor's origin (the MonacoBinding uses the doc's
 * clientID by default; y-monaco tags local edits so they can be scoped).
 */
export class CollaborativeUndoManager {
  private readonly undoManager: Y.UndoManager;

  constructor(target: Y.Text, trackedOrigins: Set<unknown> = new Set()) {
    this.undoManager = new Y.UndoManager(target, {
      // Only local-origin changes are undoable by this user.
      trackedOrigins,
      captureTimeout: 300, // group rapid keystrokes into one undo step
    });
  }

  /** Add an origin (e.g. the Monaco binding) to the local undo scope. */
  addTrackedOrigin(origin: unknown): void {
    this.undoManager.trackedOrigins.add(origin);
  }

  undo(): void {
    this.undoManager.undo();
  }
  redo(): void {
    this.undoManager.redo();
  }
  get canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }
  clear(): void {
    this.undoManager.clear();
  }
  onStackChange(listener: () => void): () => void {
    this.undoManager.on('stack-item-added', listener);
    this.undoManager.on('stack-item-popped', listener);
    return () => {
      this.undoManager.off('stack-item-added', listener);
      this.undoManager.off('stack-item-popped', listener);
    };
  }
  destroy(): void {
    this.undoManager.destroy();
  }
}
