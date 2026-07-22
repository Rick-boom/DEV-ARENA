import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectAuth, selectIsAuthenticated, selectIsBootstrapping } from '@/store/selectors.js';
import { sessionEnded, sessionEstablished, sessionLoading } from '@/store/slices/auth-slice.js';
import { notifyError } from '@/store/slices/notification-slice.js';
import { useLoginMutation, useLogoutMutation, useSignupMutation } from '@/store/api/auth-api.js';
import { DEFAULT_AUTHENTICATED_ROUTE, ROUTES } from '@/constants/routes.js';
import type { LoginPayload, SignupPayload } from '@/types/auth.types.js';
import type { NormalizedError } from '@/types/api.types.js';

/**
 * The one hook components use for authentication. It hides the
 * mutation + slice + navigation choreography so a form does
 * `await login(values)` and nothing else.
 *
 * Returns errors rather than throwing, so forms can map them onto
 * fields instead of wrapping every call in try/catch.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isBootstrapping = useAppSelector(selectIsBootstrapping);

  const [loginMutation, loginState] = useLoginMutation();
  const [signupMutation, signupState] = useSignupMutation();
  const [logoutMutation] = useLogoutMutation();

  const login = useCallback(
    async (payload: LoginPayload): Promise<NormalizedError | null> => {
      dispatch(sessionLoading());
      try {
        const result = await loginMutation(payload).unwrap();
        dispatch(
          sessionEstablished({
            user: result.user,
            accessToken: result.accessToken,
            rememberMe: payload.rememberMe,
          }),
        );
        navigate(auth.returnTo ?? DEFAULT_AUTHENTICATED_ROUTE, { replace: true });
        return null;
      } catch (error) {
        dispatch(sessionEnded());
        return error as NormalizedError;
      }
    },
    [auth.returnTo, dispatch, loginMutation, navigate],
  );

  const signup = useCallback(
    async (payload: SignupPayload): Promise<NormalizedError | null> => {
      dispatch(sessionLoading());
      try {
        const result = await signupMutation(payload).unwrap();
        dispatch(sessionEstablished({ user: result.user, accessToken: result.accessToken }));
        navigate(DEFAULT_AUTHENTICATED_ROUTE, { replace: true });
        return null;
      } catch (error) {
        dispatch(sessionEnded());
        return error as NormalizedError;
      }
    },
    [dispatch, navigate, signupMutation],
  );

  const logout = useCallback(
    async (reason?: string): Promise<void> => {
      try {
        // Best effort: the server should revoke the refresh cookie, but a
        // failure here must not strand the user in a signed-in shell.
        await logoutMutation().unwrap();
      } catch {
        dispatch(
          notifyError('Signed out locally', 'We could not reach the server to end the session.'),
        );
      } finally {
        dispatch(sessionEnded(reason ? { reason } : undefined));
        navigate(ROUTES.LOGIN, { replace: true });
      }
    },
    [dispatch, logoutMutation, navigate],
  );

  return {
    user: auth.user,
    status: auth.status,
    isAuthenticated,
    isBootstrapping,
    isSubmitting: loginState.isLoading || signupState.isLoading,
    login,
    signup,
    logout,
  };
}
