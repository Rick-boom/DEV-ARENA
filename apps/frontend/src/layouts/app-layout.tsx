import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from '@/components/organisms/sidebar.js';
import { Topbar } from '@/components/organisms/topbar.js';
import { ErrorBoundary } from '@/components/organisms/error-boundary.js';
import { PageTransition } from '@/components/organisms/page-transition.js';
import { EmailVerificationNotice } from '@/features/auth/components/email-verification-notice.js';

/**
 * The signed-in application shell: sidebar + topbar + content.
 *
 * A SECOND error boundary wraps only the content area. The one in
 * RootLayout catches everything, but nesting here means a page crash
 * leaves the navigation intact so the user can move somewhere else
 * instead of hitting a dead end.
 */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <EmailVerificationNotice />

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <ErrorBoundary resetKey={location.pathname}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
