import type * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type { editor } from 'monaco-editor';

/**
 * ── Binding Monaco to the CRDT ──────────────────────────────────────
 * The document text lives in a Y.Text (the CRDT). Monaco has its own
 * text model. y-monaco's MonacoBinding keeps the two in lockstep:
 *   • local Monaco edits are translated into Y.Text operations (which
 *     become CRDT items and propagate),
 *   • remote Y.Text changes are applied back into the Monaco model
 *     WITHOUT clobbering the local cursor.
 * Crucially the binding maps edits by CRDT position, so two people
 * editing different regions never conflict, and edits at the same region
 * merge deterministically. This is the "automatic merge / conflict-free"
 * requirement satisfied by construction — there is no merge code to write.
 *
 * The binding also feeds Monaco's cursor selections into Awareness, so
 * remote peers can render our cursor.
 */
export interface EditorBindingHandle {
  binding: MonacoBinding;
  destroy: () => void;
}

export function bindMonaco(
  yText: Y.Text,
  model: editor.ITextModel,
  editors: editor.IStandaloneCodeEditor,
  awareness: Awareness,
): EditorBindingHandle {
  // Passing the editor into the binding lets y-monaco relay local cursor
  // selections into awareness automatically (the set is editors to bind).
  const binding = new MonacoBinding(yText, model, new Set([editors]), awareness);
  return {
    binding,
    destroy: () => binding.destroy(),
  };
}
