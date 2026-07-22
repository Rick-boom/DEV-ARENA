import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels';
import type { editor } from 'monaco-editor';
import { Play, Send } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { ErrorBoundary } from '@/components/organisms/error-boundary.js';
import { ProblemPanel } from './problem-panel.js';
import { EditorToolbar } from './editor-toolbar.js';
import { ConsolePanel } from './console-panel.js';
import { useWorkspaceActions } from '../hooks/use-workspace-actions.js';
import { useAutosave, loadDraft } from '../hooks/use-autosave.js';
import { useSubmissionPolling } from '../hooks/use-submission-polling.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectEditor, selectWorkspace } from '@/store/selectors.js';
import { draftChanged, draftHydrated, draftKey, draftReset } from '@/store/slices/editor-slice.js';
import {
  PANEL_IDS,
  horizontalLayoutChanged,
  verticalLayoutChanged,
} from '@/store/slices/workspace-slice.js';
import { workspaceReset } from '@/store/slices/submission-slice.js';
import { LANGUAGE_BY_ID } from '@/constants/editor.js';
import { cn } from '@/utils/cn.js';
import type { ProblemDetail } from '@/types/problem.types.js';

/**
 * Monaco is code-split.
 *
 * The editor bundle dwarfs the rest of the app, and nobody browsing the
 * problem list should pay for it. Lazily importing here means the
 * download starts when a workspace opens, behind a Suspense fallback.
 */
const CodeEditor = lazy(() => import('./code-editor.js').then((m) => ({ default: m.CodeEditor })));

const handleClass =
  'relative bg-[var(--color-border)] transition-colors data-[resize-handle-state=hover]:bg-[var(--color-accent)] data-[resize-handle-state=drag]:bg-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]';

/**
 * The full workspace: problem on the left, editor + console on the right.
 *
 * Panel sizes are persisted (see workspace slice) because layout is a
 * preference that should survive navigation. `react-resizable-panels`
 * gives the handles real keyboard support, which a hand-rolled drag
 * implementation almost never does.
 */
export function WorkspaceShell({ problem }: { problem: ProblemDetail }) {
  const dispatch = useAppDispatch();
  const { language, drafts } = useAppSelector(selectEditor);
  const { horizontalLayout, verticalLayout } = useAppSelector(selectWorkspace);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const code = drafts[draftKey(problem.id, language)] ?? '';
  const { run, submit, isRunning, isSubmitting } = useWorkspaceActions(
    problem.id,
    problem.testCases,
  );

  useAutosave(problem.id, language, code);
  useSubmissionPolling();

  /**
   * Seed the buffer: a saved draft wins over the server's starter code,
   * because a returning user's work must never be silently replaced.
   */
  useEffect(() => {
    const existing = drafts[draftKey(problem.id, language)];
    if (existing !== undefined) return;

    const saved = loadDraft(problem.id, language);
    const starter = problem.starterCode[language] ?? LANGUAGE_BY_ID.get(language)?.starter ?? '';
    dispatch(draftHydrated({ problemId: problem.id, language, code: saved ?? starter }));
  }, [dispatch, drafts, language, problem.id, problem.starterCode]);

  // Moving to another problem clears transient run/submit output.
  useEffect(() => {
    dispatch(workspaceReset());
  }, [dispatch, problem.id]);

  const handleChange = useCallback(
    (next: string) => {
      dispatch(draftChanged({ problemId: problem.id, language, code: next }));
    },
    [dispatch, language, problem.id],
  );

  const handleFormat = useCallback(() => {
    void editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const handleReset = useCallback(() => {
    const starter = problem.starterCode[language] ?? LANGUAGE_BY_ID.get(language)?.starter ?? '';
    dispatch(draftReset({ problemId: problem.id, language, code: starter }));
  }, [dispatch, language, problem.id, problem.starterCode]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <Group
        orientation="horizontal"
        defaultLayout={horizontalLayout}
        onLayoutChanged={(layout: Layout) => dispatch(horizontalLayoutChanged(layout))}
        className="min-h-0 flex-1"
      >
        <Panel id={PANEL_IDS.PROBLEM} minSize={25} className="min-w-0">
          <ErrorBoundary resetKey={problem.id}>
            <ProblemPanel problem={problem} />
          </ErrorBoundary>
        </Panel>

        <Separator className={cn(handleClass, 'w-px cursor-col-resize')} />

        <Panel id={PANEL_IDS.EDITOR_AREA} minSize={30} className="min-w-0">
          <Group
            orientation="vertical"
            defaultLayout={verticalLayout}
            onLayoutChanged={(layout: Layout) => dispatch(verticalLayoutChanged(layout))}
          >
            <Panel id={PANEL_IDS.EDITOR} minSize={25}>
              <div className="flex h-full min-h-0 flex-col">
                <EditorToolbar onFormat={handleFormat} onReset={handleReset} />
                <div className="min-h-0 flex-1">
                  {/* A crash inside Monaco must not take the page down —
                      the user's draft is safe in Redux and storage. */}
                  <ErrorBoundary
                    resetKey={`${problem.id}:${language}`}
                    fallback={(error, reset) => (
                      <div className="grid h-full place-items-center p-6 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-[13px] text-[var(--color-fg-muted)]">
                            The editor stopped responding. Your code is saved.
                          </p>
                          <p className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                            {error.message}
                          </p>
                          <Button size="sm" onClick={reset}>
                            Reload editor
                          </Button>
                        </div>
                      </div>
                    )}
                  >
                    <Suspense
                      fallback={
                        <div className="grid h-full place-items-center">
                          <Spinner label="Loading editor" />
                        </div>
                      }
                    >
                      <CodeEditor
                        value={code}
                        language={language}
                        onChange={handleChange}
                        onRun={() => void run()}
                        onSubmit={() => void submit()}
                      />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </div>
            </Panel>

            <Separator className={cn(handleClass, 'h-px cursor-row-resize')} />

            <Panel id={PANEL_IDS.CONSOLE} minSize={12}>
              <ConsolePanel testCases={problem.testCases} />
            </Panel>
          </Group>
        </Panel>
      </Group>

      {/* Action bar pinned at the bottom so Run/Submit never scroll away. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
          {problem.timeLimitMs} ms · {problem.memoryLimitMb} MB
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void run()} loading={isRunning}>
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Run
          </Button>
          <Button size="sm" onClick={() => void submit()} loading={isSubmitting}>
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
