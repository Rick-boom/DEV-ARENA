import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { AUTOSAVE, EDITOR_DEFAULTS } from '@/constants/editor.js';
import { STORAGE_KEYS } from '@/constants/app.js';
import { storage } from '@/utils/storage.js';
import type { Language } from '@/types/problem.types.js';

/**
 * Editor state.
 *
 * Drafts are keyed per (problem, language) so switching language never
 * destroys work in another one — the single most annoying failure mode
 * in this kind of editor. They're mirrored to localStorage so a reload
 * or crash doesn't lose an in-progress solution.
 *
 * Preferences (font size, minimap, wrap) are global rather than
 * per-problem: they describe how the user likes to read code, not
 * anything about a particular problem.
 */
export interface EditorPreferences {
  fontSize: number;
  minimap: boolean;
  wordWrap: boolean;
  tabSize: number;
}

export interface EditorState {
  language: Language;
  /** draftKey -> source, where draftKey is `${problemId}:${language}` */
  drafts: Record<string, string>;
  preferences: EditorPreferences;
  /** last time the active draft was persisted, for the "Saved" indicator */
  lastSavedAt: number | null;
  isDirty: boolean;
}

const STORED_PREFS_KEY = `${STORAGE_KEYS.THEME.split(':')[0]}:editor-prefs`;

export function draftKey(problemId: string, language: Language): string {
  return `${problemId}:${language}`;
}

const initialState: EditorState = {
  language: storage.get<Language>(`${STORED_PREFS_KEY}:lang`, EDITOR_DEFAULTS.language),
  drafts: {},
  preferences: storage.get<EditorPreferences>(STORED_PREFS_KEY, {
    fontSize: EDITOR_DEFAULTS.fontSize,
    minimap: EDITOR_DEFAULTS.minimap,
    wordWrap: EDITOR_DEFAULTS.wordWrap,
    tabSize: EDITOR_DEFAULTS.tabSize,
  }),
  lastSavedAt: null,
  isDirty: false,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    languageChanged(state, action: PayloadAction<Language>) {
      state.language = action.payload;
      storage.set(`${STORED_PREFS_KEY}:lang`, action.payload);
    },

    draftChanged(
      state,
      action: PayloadAction<{ problemId: string; language: Language; code: string }>,
    ) {
      const { problemId, language, code } = action.payload;
      state.drafts[draftKey(problemId, language)] = code;
      state.isDirty = true;
    },

    /** Called after the debounced write to storage lands. */
    draftPersisted(state) {
      state.isDirty = false;
      state.lastSavedAt = Date.now();
    },

    /** Seeds a draft from the server's starter code on first open. */
    draftHydrated(
      state,
      action: PayloadAction<{ problemId: string; language: Language; code: string }>,
    ) {
      const key = draftKey(action.payload.problemId, action.payload.language);
      if (state.drafts[key] === undefined) state.drafts[key] = action.payload.code;
    },

    draftReset(
      state,
      action: PayloadAction<{ problemId: string; language: Language; code: string }>,
    ) {
      const { problemId, language, code } = action.payload;
      state.drafts[draftKey(problemId, language)] = code;
      state.isDirty = true;
      storage.remove(AUTOSAVE.key(problemId, language));
    },

    preferencesChanged(state, action: PayloadAction<Partial<EditorPreferences>>) {
      state.preferences = { ...state.preferences, ...action.payload };
      storage.set(STORED_PREFS_KEY, state.preferences);
    },

    fontSizeStepped(state, action: PayloadAction<1 | -1>) {
      const next = state.preferences.fontSize + action.payload;
      state.preferences.fontSize = Math.min(
        EDITOR_DEFAULTS.maxFontSize,
        Math.max(EDITOR_DEFAULTS.minFontSize, next),
      );
      storage.set(STORED_PREFS_KEY, state.preferences);
    },
  },
});

export const {
  languageChanged,
  draftChanged,
  draftPersisted,
  draftHydrated,
  draftReset,
  preferencesChanged,
  fontSizeStepped,
} = editorSlice.actions;

export const editorReducer = editorSlice.reducer;
