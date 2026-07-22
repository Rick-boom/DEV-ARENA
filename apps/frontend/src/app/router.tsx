import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { RootLayout } from '@/layouts/root-layout.js';
import { AuthLayout } from '@/layouts/auth-layout.js';
import { AppLayout } from '@/layouts/app-layout.js';
import { PublicLayout } from '@/layouts/public-layout.js';
import { ProtectedRoute } from '@/features/auth/guards/protected-route.js';
import { PublicOnlyRoute } from '@/features/auth/guards/public-route.js';
import { FullScreenLoader } from '@/components/organisms/full-screen-loader.js';
import { LandingPage } from '@/pages/landing-page.js';
import { LoginPage } from '@/pages/auth/login-page.js';
import { SignupPage } from '@/pages/auth/signup-page.js';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page.js';
import { ResetPasswordPage } from '@/pages/auth/reset-password-page.js';
import { VerifyEmailPage } from '@/pages/auth/verify-email-page.js';
import { OAuthCallbackPage } from '@/pages/auth/oauth-callback-page.js';
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from '@/pages/errors/error-page.js';
import { ROUTES } from '@/constants/routes.js';

/**
 * Route table.
 *
 * Three tiers, each with its own guard and chrome:
 *   public-only  → auth screens, redirect away if already signed in
 *   protected    → the app shell, redirect to login if not
 *   open         → landing and error screens, no guard
 *
 * Signed-in pages are lazy so the auth bundle stays small: a first-time
 * visitor should not download the dashboard to read a login form.
 * AnimatePresence keys on pathname so exit animations actually run.
 */
const DashboardPage = lazy(() =>
  import('@/pages/dashboard-page.js').then((m) => ({ default: m.DashboardPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings-page.js').then((m) => ({ default: m.SettingsPage })),
);
const ProblemsPage = lazy(() =>
  import('@/pages/problems-page.js').then((m) => ({ default: m.ProblemsPage })),
);
// The workspace pulls in Monaco — by far the heaviest chunk in the app,
// so it is split away from everything else.
const ProblemWorkspacePage = lazy(() =>
  import('@/pages/problem-workspace-page.js').then((m) => ({ default: m.ProblemWorkspacePage })),
);

export function AppRouter() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<RootLayout />}>
          {/* Open */}
          <Route element={<PublicLayout />}>
            <Route path={ROUTES.HOME} element={<LandingPage />} />
          </Route>

          {/* Public-only (redirect authenticated users away) */}
          <Route element={<PublicOnlyRoute />}>
            <Route element={<AuthLayout />}>
              <Route path={ROUTES.LOGIN} element={<LoginPage />} />
              <Route path={ROUTES.SIGNUP} element={<SignupPage />} />
              <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
              <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
            </Route>
          </Route>

          {/* Reachable either way — the token in the URL is the credential */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmailPage />} />
          </Route>
          <Route path={ROUTES.OAUTH_CALLBACK} element={<OAuthCallbackPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route
                path={ROUTES.DASHBOARD}
                element={
                  <Suspense fallback={<FullScreenLoader label="Loading dashboard" />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.PROBLEMS}
                element={
                  <Suspense fallback={<FullScreenLoader label="Loading problems" />}>
                    <ProblemsPage />
                  </Suspense>
                }
              />
              <Route
                path="/problems/:slug"
                element={
                  <Suspense fallback={<FullScreenLoader label="Opening workspace" />}>
                    <ProblemWorkspacePage />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.SETTINGS}
                element={
                  <Suspense fallback={<FullScreenLoader label="Loading settings" />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          {/* Errors */}
          <Route path={ROUTES.FORBIDDEN} element={<ForbiddenPage />} />
          <Route path={ROUTES.SERVER_ERROR} element={<ServerErrorPage />} />
          <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}
