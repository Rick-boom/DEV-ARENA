import { useEffect } from 'react';
import { useAppSelector } from '@/store/hooks.js';
import { selectAuth, selectIsAuthenticated } from '@/store/selectors.js';
import { SESSION, STORAGE_KEYS } from '@/constants/app.js';
import { storage } from '@/utils/storage.js';
import { tokenStore } from '@/services/token-store.js';
import { useAuth } from './use-auth.js';

const ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'visibilitychange',
] as const;

/**
 * Idle auto-logout. "Remember me" doesn't disable it — it extends the
 * window, which is the honest reading of that checkbox: stay signed in
 * across restarts, not forever on a shared machine.
 *
 * The last-activity stamp is written to storage so the timer survives a
 * reload, and a polling check (rather than one long timeout) keeps it
 * correct when the tab is throttled in the background.
 */
export function useAutoLogout(): void {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { rememberMe } = useAppSelector(selectAuth);
  const { logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const limit = rememberMe ? SESSION.IDLE_TIMEOUT_REMEMBERED_MS : SESSION.IDLE_TIMEOUT_MS;
    const touch = (): void => storage.set(STORAGE_KEYS.LAST_ACTIVE, Date.now());
    touch();

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, touch, { passive: true }));

    const interval = setInterval(() => {
      const last = storage.get<number>(STORAGE_KEYS.LAST_ACTIVE, Date.now());
      if (Date.now() - last > limit) {
        void logout('You were signed out after a period of inactivity.');
      }
    }, SESSION.IDLE_POLL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, touch));
      clearInterval(interval);
    };
  }, [isAuthenticated, rememberMe, logout]);

  /**
   * The network layer forces a logout when a refresh is rejected mid-
   * session (revoked token, password change elsewhere). Wiring it here
   * keeps the axios interceptors free of React and Redux imports.
   */
  useEffect(() => {
    tokenStore.onSessionExpired(() => {
      void logout('Your session expired. Sign in to continue.');
    });
    return () => tokenStore.onSessionExpired(null);
  }, [logout]);
}
