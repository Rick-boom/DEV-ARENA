import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button.js';
import { Alert } from '@/components/ui/alert.js';
import { FullScreenLoader } from '@/components/organisms/full-screen-loader.js';
import { useExchangeOAuthMutation } from '@/store/api/auth-api.js';
import { useAppDispatch } from '@/store/hooks.js';
import { sessionEstablished, sessionLoading, sessionFailed } from '@/store/slices/auth-slice.js';
import { DEFAULT_AUTHENTICATED_ROUTE, ROUTES } from '@/constants/routes.js';
import { OAuthProvider } from '@/types/auth.types.js';
import { NotificationVariant } from '@/types/ui.types.js';
import type { NormalizedError } from '@/types/api.types.js';

/**
 * OAuth return leg. The provider redirects here with `code`; we exchange
 * it server-side for a session. The code is never trusted as a session
 * on its own and never persisted — it's spent immediately and once.
 */
export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [exchangeOAuth] = useExchangeOAuthMutation();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const code = params.get('code');
  const state = params.get('state') ?? undefined;
  const provider = (params.get('provider') ?? OAuthProvider.GOOGLE) as OAuthProvider;
  const providerError = params.get('error');

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (providerError) {
      setError('The sign-in was cancelled before it finished.');
      dispatch(sessionFailed(null));
      return;
    }
    if (!code) {
      setError('This callback is missing its authorization code.');
      dispatch(sessionFailed(null));
      return;
    }

    void (async () => {
      dispatch(sessionLoading());
      try {
        const result = await exchangeOAuth({ provider, code, state }).unwrap();
        dispatch(sessionEstablished({ user: result.user, accessToken: result.accessToken }));
        navigate(DEFAULT_AUTHENTICATED_ROUTE, { replace: true });
      } catch (err) {
        const normalized = err as NormalizedError;
        setError(normalized.message);
        dispatch(sessionFailed(normalized.message));
      }
    })();
  }, [code, state, provider, providerError, exchangeOAuth, dispatch, navigate]);

  if (!error) return <FullScreenLoader label="Completing sign-in" />;

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <Alert variant={NotificationVariant.ERROR} title="Sign-in didn't complete">
          {error}
        </Alert>
        <Button asChild full>
          <Link to={ROUTES.LOGIN}>Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
