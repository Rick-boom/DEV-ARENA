import * as Y from 'yjs';

/**
 * ── Version recovery via CRDT snapshots ─────────────────────────────
 * Yjs can capture an immutable SNAPSHOT — a state vector + delete set —
 * that pins a moment in the document's history WITHOUT storing a full
 * copy. Given the doc still holds its history (gc disabled), any past
 * snapshot can be materialized back into readable text. That's how we
 * offer "restore an earlier version" cheaply: we keep a list of
 * snapshots (bytes) and can diff or restore any of them.
 *
 * NOTE: recovering history requires the doc to retain deleted content,
 * so the recovery-enabled doc is created with { gc: false }.
 */
export interface NamedSnapshot {
  id: string;
  label: string;
  at: number;
  bytes: Uint8Array;
}

export class VersionRecovery {
  private readonly snapshots: NamedSnapshot[] = [];

  constructor(private readonly doc: Y.Doc) {}

  /** Capture the current document version. */
  capture(label: string): NamedSnapshot {
    const snapshot = Y.snapshot(this.doc);
    const entry: NamedSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      at: Date.now(),
      bytes: Y.encodeSnapshot(snapshot),
    };
    this.snapshots.push(entry);
    return entry;
  }

  list(): readonly NamedSnapshot[] {
    return this.snapshots;
  }

  /**
   * Materialize the text of a Y.Text field as it existed at a snapshot.
   * Returns the historical content without mutating the live doc.
   */
  textAt(snapshotBytes: Uint8Array, field: string): string {
    const snapshot = Y.decodeSnapshot(snapshotBytes);
    // Reconstruct a doc restricted to the snapshot's state.
    const restored = Y.createDocFromSnapshot(this.doc, snapshot);
    try {
      return restored.getText(field).toString();
    } finally {
      restored.destroy();
    }
  }

  /**
   * Restore a snapshot's content into the live doc as a NEW edit (so it
   * merges/propagates like any change and remains undoable).
   */
  restore(snapshotBytes: Uint8Array, field: string): void {
    const historical = this.textAt(snapshotBytes, field);
    const liveText = this.doc.getText(field);
    this.doc.transact(() => {
      liveText.delete(0, liveText.length);
      liveText.insert(0, historical);
    }, 'version-recovery');
  }
}
