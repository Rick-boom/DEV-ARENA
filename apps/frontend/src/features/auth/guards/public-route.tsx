import { Navigate, Outlet } from 'react-router';
import { useAppSelector } from '@/store/hooks.js';
import { selectIsAuthenticated, selectIsBootstrapping } from '@/store/selectors.js';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/constants/routes.js';
import { FullScreenLoader } from '@/components/organisms/full-screen-loader.js';

/**
 * Gate for auth-only-when-signed-out routes (login, signup, reset).
 * Sending an already-authenticated user back to the app avoids the
 * confusing state where someone signs in twice, and keeps the back
 * button from landing on a stale login form.
 */
export function PublicOnlyRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isBootstrapping = useAppSelector(selectIsBootstrapping);

  if (isBootstrapping) return <FullScreenLoader label="Checking your session" />;
  if (isAuthenticated) return <Navigate to={DEFAULT_AUTHENTICATED_ROUTE} replace />;
  return <Outlet />;
}
