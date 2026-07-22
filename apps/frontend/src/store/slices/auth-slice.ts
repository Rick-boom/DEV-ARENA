import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { AuthStatus, type User } from '@/types/auth.types.js';
import { STORAGE_KEYS } from '@/constants/app.js';
import { storage } from '@/utils/storage.js';
import { tokenStore } from '@/services/token-store.js';
import { expiryOf } from '@/utils/jwt.js';

/**
 * Authentication state: who is signed in and what the app should render
 * while it finds out. The ACCESS TOKEN is intentionally absent from this
 * slice — it lives in the in-memory tokenStore so it never reaches
 * devtools, localStorage, or a serialized state snapshot.
 *
 * `status` starts at IDLE, not UNAUTHENTICATED: on first paint we don't
 * yet know whether a refresh cookie exists, and rendering the login page
 * before session recovery finishes would flash logged-out users' screens.
 */
export interface AuthState {
  status: AuthStatus;
  user: User | null;
  rememberMe: boolean;
  /** path to return to after login, captured by the route guard */
  returnTo: string | null;
  error: string | null;
}

const initialState: AuthState = {
  status: AuthStatus.IDLE,
  user: null,
  rememberMe: storage.get<boolean>(STORAGE_KEYS.REMEMBER_ME, false),
  returnTo: null,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionLoading(state) {
      state.status = AuthStatus.LOADING;
      state.error = null;
    },

    /** Login / signup / refresh all funnel here. */
    sessionEstablished(
      state,
      action: PayloadAction<{ user: User; accessToken: string; rememberMe?: boolean }>,
    ) {
      const { user, accessToken, rememberMe } = action.payload;
      state.status = AuthStatus.AUTHENTICATED;
      state.user = user;
      state.error = null;
      if (rememberMe !== undefined) {
        state.rememberMe = rememberMe;
        storage.set(STORAGE_KEYS.REMEMBER_ME, rememberMe);
      }
      tokenStore.set({ accessToken, expiresAt: expiryOf(accessToken) });
    },

    sessionEnded(state, action: PayloadAction<{ reason?: string } | undefined>) {
      state.status = AuthStatus.UNAUTHENTICATED;
      state.user = null;
      state.error = action.payload?.reason ?? null;
      tokenStore.clear();
      storage.remove(STORAGE_KEYS.LAST_ACTIVE);
    },

    sessionFailed(state, action: PayloadAction<string | null>) {
      state.status = AuthStatus.UNAUTHENTICATED;
      state.user = null;
      state.error = action.payload;
      tokenStore.clear();
    },

    userUpdated(state, action: PayloadAction<Partial<User>>) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },

    /** Guard captures where the visitor was headed before the redirect. */
    returnToSet(state, action: PayloadAction<string | null>) {
      state.returnTo = action.payload;
    },

    rememberMeSet(state, action: PayloadAction<boolean>) {
      state.rememberMe = action.payload;
      storage.set(STORAGE_KEYS.REMEMBER_ME, action.payload);
    },
  },
});

export const {
  sessionLoading,
  sessionEstablished,
  sessionEnded,
  sessionFailed,
  userUpdated,
  returnToSet,
  rememberMeSet,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
