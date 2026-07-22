import type { Monaco } from '@monaco-editor/react';
import { MONACO_THEME } from '@/constants/editor.js';

/**
 * Monaco themes derived from the app's design tokens.
 *
 * Monaco cannot read CSS custom properties — it needs literal hex at
 * registration time — so the palette is mirrored here. Keeping it in one
 * function next to the token names it shadows makes the coupling
 * explicit rather than scattering hex through the editor config.
 *
 * The goal is that the editor looks like part of the app, not an iframe
 * someone embedded: same canvas, same borders, same accent.
 */
export function registerMonacoThemes(monaco: Monaco): void {
  monaco.editor.defineTheme(MONACO_THEME.DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c5c66', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a78bfa' },
      { token: 'string', foreground: '7ee2b8' },
      { token: 'number', foreground: 'ffb86b' },
      { token: 'type', foreground: '7dd3fc' },
      { token: 'function', foreground: '93c5fd' },
      { token: 'variable', foreground: 'ededf0' },
    ],
    colors: {
      'editor.background': '#0f0f12',
      'editor.foreground': '#ededf0',
      'editorLineNumber.foreground': '#3f3f47',
      'editorLineNumber.activeForeground': '#8b8b96',
      'editor.selectionBackground': '#6e56cf44',
      'editor.lineHighlightBackground': '#17171b',
      'editorCursor.foreground': '#6e56cf',
      'editorIndentGuide.background1': '#232329',
      'editorWidget.background': '#17171b',
      'editorWidget.border': '#232329',
      'editorSuggestWidget.selectedBackground': '#6e56cf33',
      'scrollbarSlider.background': '#23232999',
    },
  });

  monaco.editor.defineTheme(MONACO_THEME.LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8f8f9a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '5b44bd' },
      { token: 'string', foreground: '0f7b52' },
      { token: 'number', foreground: '9a5b00' },
      { token: 'type', foreground: '0b6bcb' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#17171a',
      'editorLineNumber.foreground': '#c2c2cc',
      'editorLineNumber.activeForeground': '#62626d',
      'editor.selectionBackground': '#5b44bd22',
      'editor.lineHighlightBackground': '#fafafa',
      'editorCursor.foreground': '#5b44bd',
      'editorIndentGuide.background1': '#e6e6ea',
    },
  });
}

/**
 * TypeScript/JavaScript language services.
 *
 * Diagnostics for missing imports are silenced because a solution file
 * is a fragment, not a module — flagging "cannot find name" on a helper
 * the judge provides would be noise the user can't act on.
 */
export function configureLanguageDefaults(monaco: Monaco): void {
  const ts = monaco.languages.typescript;

  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    lib: ['es2020'],
    noEmit: true,
  });

  ts.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    // 2304 "cannot find name", 2552 "did you mean" — see note above.
    diagnosticCodesToIgnore: [2304, 2552, 2307],
  });
}
