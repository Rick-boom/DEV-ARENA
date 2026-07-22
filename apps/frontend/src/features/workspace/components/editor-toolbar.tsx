import { Minus, Plus, RotateCcw, Save, Text, WrapText } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { LANGUAGES } from '@/constants/editor.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectEditor } from '@/store/selectors.js';
import {
  fontSizeStepped,
  languageChanged,
  preferencesChanged,
} from '@/store/slices/editor-slice.js';
import { cn } from '@/utils/cn.js';
import type { Language } from '@/types/problem.types.js';

/**
 * Editor chrome: language picker, view preferences, format and reset.
 *
 * The save indicator is passive — autosave is automatic, so the control
 * reports state rather than offering an action. Telling someone their
 * work is saved is more useful than asking them to save it.
 */
export function EditorToolbar({
  onFormat,
  onReset,
}: {
  onFormat: () => void;
  onReset: () => void;
}) {
  const dispatch = useAppDispatch();
  const { language, preferences, isDirty, lastSavedAt } = useAppSelector(selectEditor);

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
      <label className="sr-only" htmlFor="language-select">
        Language
      </label>
      <select
        id="language-select"
        value={language}
        onChange={(event) => dispatch(languageChanged(event.target.value as Language))}
        className={cn(
          'h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-2',
          'text-[12px] text-[var(--color-fg)] outline-none',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]',
        )}
      >
        {LANGUAGES.map((meta) => (
          <option key={meta.id} value={meta.id}>
            {meta.label}
          </option>
        ))}
      </select>

      <span className="h-4 w-px bg-[var(--color-border)]" aria-hidden="true" />

      <div className="flex items-center" role="group" aria-label="Font size">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => dispatch(fontSizeStepped(-1))}
          aria-label="Decrease font size"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-7 text-center font-mono text-[11px] text-[var(--color-fg-subtle)]">
          {preferences.fontSize}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => dispatch(fontSizeStepped(1))}
          aria-label="Increase font size"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7', preferences.wordWrap && 'text-[var(--color-accent)]')}
        onClick={() => dispatch(preferencesChanged({ wordWrap: !preferences.wordWrap }))}
        aria-label="Toggle word wrap"
        aria-pressed={preferences.wordWrap}
      >
        <WrapText className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7', preferences.minimap && 'text-[var(--color-accent)]')}
        onClick={() => dispatch(preferencesChanged({ minimap: !preferences.minimap }))}
        aria-label="Toggle minimap"
        aria-pressed={preferences.minimap}
      >
        <Text className="h-3.5 w-3.5" />
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        {isDirty ? (
          <Badge variant="neutral">unsaved</Badge>
        ) : lastSavedAt ? (
          <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--color-fg-subtle)]">
            <Save className="h-3 w-3" aria-hidden="true" />
            saved
          </span>
        ) : null}

        <Button variant="ghost" size="sm" className="h-7" onClick={onFormat}>
          Format
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onReset}
          aria-label="Reset to starter code"
          title="Reset to starter code"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
