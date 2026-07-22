import { useEffect, useRef } from 'react';
import { AUTOSAVE } from '@/constants/editor.js';
import { storage } from '@/utils/storage.js';
import { useAppDispatch } from '@/store/hooks.js';
import { draftPersisted } from '@/store/slices/editor-slice.js';
import type { Language } from '@/types/problem.types.js';

/**
 * Debounced draft persistence.
 *
 * Writing on every keystroke would hit localStorage hundreds of times a
 * minute and block the main thread during fast typing; debouncing turns
 * that into one write per pause. The pending write is flushed on unmount
 * so navigating away mid-edit still saves.
 */
export function useAutosave(problemId: string, language: Language, code: string): void {
  const dispatch = useAppDispatch();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ problemId, language, code });

  latest.current = { problemId, language, code };

  useEffect(() => {
    if (!problemId || code === '') return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      storage.set(AUTOSAVE.key(problemId, language), code);
      dispatch(draftPersisted());
      timer.current = null;
    }, AUTOSAVE.DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [problemId, language, code, dispatch]);

  // Flush on unmount — a queued write must not be lost to navigation.
  useEffect(() => {
    return () => {
      const { problemId: id, language: lang, code: source } = latest.current;
      if (id && source) storage.set(AUTOSAVE.key(id, lang), source);
    };
  }, []);
}

/** Reads a persisted draft, if one exists. */
export function loadDraft(problemId: string, language: Language): string | null {
  return storage.get<string | null>(AUTOSAVE.key(problemId, language), null);
}
