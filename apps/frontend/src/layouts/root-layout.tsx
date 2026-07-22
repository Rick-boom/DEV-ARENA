import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/organisms/error-boundary.js';
import { OfflineBanner } from '@/components/organisms/offline-banner.js';
import { Toaster } from '@/components/organisms/toaster.js';

/**
 * Outermost layout: the pieces that must exist on every route regardless
 * of auth state — the offline banner, the toast region, and a boundary
 * that survives a crash in any page.
 *
 * The boundary is keyed on pathname so navigating away from a broken
 * screen clears the error rather than trapping the user there.
 */
export function RootLayout() {
  const location = useLocation();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <OfflineBanner />
      <ErrorBoundary resetKey={location.pathname}>
        <Outlet />
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
