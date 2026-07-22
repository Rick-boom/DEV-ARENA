import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * User PREFERENCES — distinct from the auth slice's identity data on
 * purpose. Identity is owned by the server and replaced wholesale on
 * every session refresh; preferences are client-owned, persist across
 * sessions, and change for reasons that have nothing to do with auth.
 * Keeping them apart stops a token refresh from resetting the sidebar.
 */
export interface UserState {
  sidebarCollapsed: boolean;
  preferredLanguage: string;
  /** in-app hints the user has dismissed */
  dismissedHints: string[];
}

const initialState: UserState = {
  sidebarCollapsed: false,
  preferredLanguage: 'javascript',
  dismissedHints: [],
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    sidebarSet(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    preferredLanguageSet(state, action: PayloadAction<string>) {
      state.preferredLanguage = action.payload;
    },
    hintDismissed(state, action: PayloadAction<string>) {
      if (!state.dismissedHints.includes(action.payload)) {
        state.dismissedHints.push(action.payload);
      }
    },
    preferencesReset() {
      return initialState;
    },
  },
});

export const { sidebarToggled, sidebarSet, preferredLanguageSet, hintDismissed, preferencesReset } =
  userSlice.actions;

export const userReducer = userSlice.reducer;
