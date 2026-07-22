import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { STORAGE_KEYS } from '@/constants/app.js';
import { storage } from '@/utils/storage.js';
import { ThemeMode, type ResolvedTheme } from '@/types/ui.types.js';

/**
 * Theme state. `mode` is what the user CHOSE (including "system");
 * `resolved` is what's actually painted. Keeping both means a user on
 * "system" follows their OS live, while a user who picked light stays
 * light regardless of the OS — a distinction a single boolean loses.
 */
export interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
}

export function systemPrefers(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolve(mode: ThemeMode): ResolvedTheme {
  return mode === ThemeMode.SYSTEM ? systemPrefers() : mode;
}

const storedMode = storage.get<ThemeMode>(STORAGE_KEYS.THEME, ThemeMode.SYSTEM);

const initialState: ThemeState = {
  mode: storedMode,
  resolved: resolve(storedMode),
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    themeSet(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
      state.resolved = resolve(action.payload);
      storage.set(STORAGE_KEYS.THEME, action.payload);
    },
    /** Cycles light → dark → system, which is what the toggle button does. */
    themeToggled(state) {
      const next =
        state.mode === ThemeMode.LIGHT
          ? ThemeMode.DARK
          : state.mode === ThemeMode.DARK
            ? ThemeMode.SYSTEM
            : ThemeMode.LIGHT;
      state.mode = next;
      state.resolved = resolve(next);
      storage.set(STORAGE_KEYS.THEME, next);
    },
    /** Fired by the media-query listener while mode === system. */
    systemThemeChanged(state, action: PayloadAction<ResolvedTheme>) {
      if (state.mode === ThemeMode.SYSTEM) state.resolved = action.payload;
    },
  },
});

export const { themeSet, themeToggled, systemThemeChanged } = themeSlice.actions;
export const themeReducer = themeSlice.reducer;
