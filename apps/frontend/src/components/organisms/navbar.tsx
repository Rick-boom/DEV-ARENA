import { Link } from 'react-router';
import { Logo } from '@/components/molecules/logo.js';
import { ThemeToggle } from '@/components/molecules/theme-toggle.js';
import { Button } from '@/components/ui/button.js';
import { useAppSelector } from '@/store/hooks.js';
import { selectIsAuthenticated } from '@/store/selectors.js';
import { ROUTES } from '@/constants/routes.js';

/**
 * Navbar (organism) — the PUBLIC header, distinct from the in-app
 * Topbar. It shows sign-in actions to visitors and a way back into the
 * app for anyone already authenticated, so a signed-in user landing on
 * the marketing page isn't asked to sign in again.
 */
export function Navbar() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to={ROUTES.HOME} className="rounded-md" aria-label="DevArena home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button size="sm" asChild>
              <Link to={ROUTES.DASHBOARD}>Open app</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to={ROUTES.LOGIN}>Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to={ROUTES.SIGNUP}>Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
