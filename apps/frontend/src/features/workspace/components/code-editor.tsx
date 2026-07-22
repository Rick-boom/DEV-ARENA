import { useCallback, useEffect, useRef } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Spinner } from '@/components/ui/spinner.js';
import { registerMonacoThemes, configureLanguageDefaults } from '../monaco-theme.js';
import { LANGUAGE_BY_ID, MONACO_THEME } from '@/constants/editor.js';
import { useAppSelector } from '@/store/hooks.js';
import { selectEditorPreferences, selectTheme } from '@/store/selectors.js';
import type { Language } from '@/types/problem.types.js';

/**
 * The Monaco wrapper.
 *
 * Deliberately dumb: it owns no application state. Code comes in as a
 * prop and changes go out through `onChange`, so the draft lives in
 * Redux where autosave, language switching and reset can all reach it.
 * An editor that owns its own buffer is impossible to reset or restore.
 *
 * Keyboard commands (Run / Submit / Format) are registered on mount so
 * they work regardless of focus inside the editor, which is where a
 * developer's hands actually are.
 */
export interface CodeEditorProps {
  value: string;
  language: Language;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
  readOnly?: boolean;
}

export function CodeEditor({
  value,
  language,
  onChange,
  onRun,
  onSubmit,
  readOnly = false,
}: CodeEditorProps) {
  const preferences = useAppSelector(selectEditorPreferences);
  const { resolved } = useAppSelector(selectTheme);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Latest callbacks without re-registering commands on every render.
  const actions = useRef({ onRun, onSubmit });
  actions.current = { onRun, onSubmit };

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    registerMonacoThemes(monaco);
    configureLanguageDefaults(monaco);
  }, []);

  const handleMount: OnMount = useCallback((instance, monaco) => {
    editorRef.current = instance;
    monacoRef.current = monaco;

    // Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits — the muscle
    // memory from every other online judge.
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      actions.current.onRun?.();
    });
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () =>
      actions.current.onSubmit?.(),
    );
    instance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => void instance.getAction('editor.action.formatDocument')?.run(),
    );
  }, []);

  // Theme follows the app rather than being a separate editor setting.
  useEffect(() => {
    monacoRef.current?.editor.setTheme(
      resolved === 'light' ? MONACO_THEME.LIGHT : MONACO_THEME.DARK,
    );
  }, [resolved]);

  const monacoLanguage = LANGUAGE_BY_ID.get(language)?.monacoId ?? 'plaintext';

  return (
    <Editor
      value={value}
      language={monacoLanguage}
      theme={resolved === 'light' ? MONACO_THEME.LIGHT : MONACO_THEME.DARK}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      onChange={(next) => onChange(next ?? '')}
      loading={
        <div className="grid h-full place-items-center">
          <Spinner label="Loading editor" />
        </div>
      }
      options={{
        readOnly,
        fontSize: preferences.fontSize,
        tabSize: preferences.tabSize,
        minimap: { enabled: preferences.minimap },
        wordWrap: preferences.wordWrap ? 'on' : 'off',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontLigatures: true,
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderLineHighlight: 'line',
        padding: { top: 14, bottom: 14 },
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: false },
        tabCompletion: 'on',
        formatOnPaste: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}

export default CodeEditor;
