import { useEffect, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import { bindMonaco, type EditorBindingHandle } from '../bindings/monaco-binding.js';
import { RemoteCursorRenderer } from '../cursor/remote-cursors.js';
import { CollaborativeUndoManager } from '../sync/undo-manager.js';
import type { CollaborationSession } from '../collaboration-session.js';
import type { CursorPosition, SelectionRange } from '../types/collab.types.js';

/**
 * Binds a mounted Monaco editor to a CollaborationSession: text sync via
 * y-monaco, remote cursor rendering, local cursor/selection → awareness,
 * and collaborative undo/redo. Call once from the editor's onMount.
 *
 * Returns undo/redo handles for wiring to buttons/keybindings.
 */
export function useMonacoCollaboration(
  session: CollaborationSession | null,
  editorInstance: editor.IStandaloneCodeEditor | null,
): { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } {
  const bindingRef = useRef<EditorBindingHandle | null>(null);
  const cursorsRef = useRef<RemoteCursorRenderer | null>(null);
  const undoRef = useRef<CollaborativeUndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!session || !editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    // 1. Text sync (Monaco ↔ Y.Text) + local cursor → awareness.
    bindingRef.current = bindMonaco(session.text, model, editorInstance, session.awareness);

    // 2. Render remote cursors/selections into this editor.
    cursorsRef.current = new RemoteCursorRenderer(editorInstance, session.awarenessManager);
    cursorsRef.current.start();

    // 3. Collaborative undo scoped to local edits.
    const undoManager = new CollaborativeUndoManager(session.text);
    undoRef.current = undoManager;
    const offStack = undoManager.onStackChange(() => {
      setCanUndo(undoManager.canUndo);
      setCanRedo(undoManager.canRedo);
    });

    // 4. Relay local cursor/selection into awareness on every move.
    const cursorDisposable = editorInstance.onDidChangeCursorPosition(
      (e: editor.ICursorPositionChangedEvent) => {
        const pos: CursorPosition = {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        };
        session.awarenessManager.setCursor(pos);
      },
    );
    const selectionDisposable = editorInstance.onDidChangeCursorSelection(
      (e: editor.ICursorSelectionChangedEvent) => {
        const s = e.selection;
        const sel: SelectionRange | null =
          s.startLineNumber === s.endLineNumber && s.startColumn === s.endColumn
            ? null
            : {
                startLineNumber: s.startLineNumber,
                startColumn: s.startColumn,
                endLineNumber: s.endLineNumber,
                endColumn: s.endColumn,
              };
        session.awarenessManager.setSelection(sel);
      },
    );

    return () => {
      offStack();
      cursorDisposable.dispose();
      selectionDisposable.dispose();
      cursorsRef.current?.destroy();
      undoManager.destroy();
      bindingRef.current?.destroy();
      bindingRef.current = null;
      cursorsRef.current = null;
      undoRef.current = null;
    };
  }, [session, editorInstance]);

  return {
    undo: () => undoRef.current?.undo(),
    redo: () => undoRef.current?.redo(),
    canUndo,
    canRedo,
  };
}
