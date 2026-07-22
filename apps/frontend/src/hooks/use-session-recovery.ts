import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/hooks.js';
import { sessionEnded, sessionEstablished, sessionLoading } from '@/store/slices/auth-slice.js';
import { useRefreshSessionMutation } from '@/store/api/auth-api.js';

/**
 * Persistent login. On boot the app asks /auth/refresh whether the
 * httpOnly cookie still identifies someone; if so the session is
 * restored before the first protected render, which is why auth status
 * starts at IDLE rather than UNAUTHENTICATED — otherwise every reload
 * would flash the login page at a signed-in user.
 *
 * Runs exactly once per mount (StrictMode double-invokes effects in dev,
 * and firing two refreshes would rotate the token twice).
 */
export function useSessionRecovery(): void {
  const dispatch = useAppDispatch();
  const [refreshSession] = useRefreshSessionMutation();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      dispatch(sessionLoading());
      try {
        const result = await refreshSession().unwrap();
        dispatch(sessionEstablished({ user: result.user, accessToken: result.accessToken }));
      } catch {
        // No cookie / expired cookie is the normal path for a visitor.
        dispatch(sessionEnded());
      }
    })();
  }, [dispatch, refreshSession]);
}
