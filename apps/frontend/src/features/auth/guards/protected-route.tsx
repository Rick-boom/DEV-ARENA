import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectIsAuthenticated, selectIsBootstrapping, selectUser } from '@/store/selectors.js';
import { returnToSet } from '@/store/slices/auth-slice.js';
import { LOGIN_ROUTE, ROUTES } from '@/constants/routes.js';
import { FullScreenLoader } from '@/components/organisms/full-screen-loader.js';
import type { UserRole } from '@/types/auth.types.js';

/**
 * Gate for signed-in routes.
 *
 * The bootstrapping check comes FIRST and is the whole reason auth
 * status has an IDLE state: redirecting while session recovery is still
 * in flight would bounce a signed-in user to the login page on every
 * reload. We hold the splash until we actually know.
 *
 * The attempted path is stashed so login can return the user to where
 * they were going instead of dumping them on the dashboard.
 */
export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isBootstrapping = useAppSelector(selectIsBootstrapping);
  const user = useAppSelector(selectUser);

  const deniedByRole = Boolean(roles && user && !roles.includes(user.role));

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      dispatch(returnToSet(location.pathname + location.search));
    }
  }, [dispatch, isAuthenticated, isBootstrapping, location.pathname, location.search]);

  if (isBootstrapping) return <FullScreenLoader label="Restoring your session" />;
  if (!isAuthenticated) return <Navigate to={LOGIN_ROUTE} replace />;
  if (deniedByRole) return <Navigate to={ROUTES.FORBIDDEN} replace />;

  return <Outlet />;
}
