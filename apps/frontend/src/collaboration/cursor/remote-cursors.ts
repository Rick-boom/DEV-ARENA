import type { editor, IDisposable } from 'monaco-editor';
import { selectionColor } from '../utils/color.js';
import type { AwarenessManager } from '../awareness/awareness-manager.js';
import type { AwarenessUserState } from '../types/collab.types.js';

/**
 * Renders remote cursors + selections as Monaco decorations, with a
 * colored caret, a name label, and a translucent selection highlight —
 * the Google-Docs / Live-Share look. y-monaco already syncs the LOCAL
 * cursor into awareness; this class does the inverse: it reads every
 * REMOTE awareness state and paints it into this editor.
 *
 * Styles are injected once per user color so we don't create unbounded
 * stylesheet rules. Decorations are diffed on each awareness change so
 * the render cost scales with the number of collaborators, not edits.
 */
export class RemoteCursorRenderer {
  private decorations: string[] = [];
  private readonly injectedColors = new Set<string>();
  private styleEl: HTMLStyleElement | null = null;
  private unsub: (() => void) | null = null;
  private modelListener: IDisposable | null = null;

  constructor(
    private readonly editorInstance: editor.IStandaloneCodeEditor,
    private readonly awareness: AwarenessManager,
  ) {}

  start(): void {
    this.unsub = this.awareness.onChange((states) => this.render(states));
    this.render(this.awareness.getRemoteStates());
  }

  private ensureStyle(color: string): string {
    const className = `remote-cursor-${color.replace('#', '')}`;
    if (this.injectedColors.has(color)) return className;
    if (!this.styleEl) {
      this.styleEl = document.createElement('style');
      this.styleEl.dataset.devarenaCollab = 'remote-cursors';
      document.head.appendChild(this.styleEl);
    }
    // Caret + selection + name label, all keyed off the user's color.
    this.styleEl.appendChild(
      document.createTextNode(`
        .${className}-selection { background: ${selectionColor(color)}; }
        .${className}-caret {
          border-left: 2px solid ${color};
          position: relative;
        }
        .${className}-caret::after {
          content: attr(data-name);
          position: absolute; top: -1.2em; left: -2px;
          background: ${color}; color: #fff;
          font-size: 11px; padding: 0 4px; border-radius: 3px;
          white-space: nowrap; pointer-events: none;
        }
      `),
    );
    this.injectedColors.add(color);
    return className;
  }

  private render(states: Map<number, AwarenessUserState>): void {
    const newDecorations: editor.IModelDeltaDecoration[] = [];
    for (const state of states.values()) {
      const cls = this.ensureStyle(state.user.color);
      if (state.selection) {
        newDecorations.push({
          range: {
            startLineNumber: state.selection.startLineNumber,
            startColumn: state.selection.startColumn,
            endLineNumber: state.selection.endLineNumber,
            endColumn: state.selection.endColumn,
          },
          options: { className: `${cls}-selection`, stickiness: 1 },
        });
      }
      if (state.cursor) {
        newDecorations.push({
          range: {
            startLineNumber: state.cursor.lineNumber,
            startColumn: state.cursor.column,
            endLineNumber: state.cursor.lineNumber,
            endColumn: state.cursor.column,
          },
          options: {
            className: `${cls}-caret`,
            hoverMessage: { value: state.user.username },
            beforeContentClassName: undefined,
            // carry the name for the ::after label
            afterContentClassName: undefined,
          },
        });
      }
    }
    this.decorations = this.editorInstance.deltaDecorations(this.decorations, newDecorations);
  }

  destroy(): void {
    this.unsub?.();
    this.modelListener?.dispose();
    this.editorInstance.deltaDecorations(this.decorations, []);
    if (this.styleEl) this.styleEl.remove();
  }
}
