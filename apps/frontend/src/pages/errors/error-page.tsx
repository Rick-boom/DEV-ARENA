import { Link } from 'react-router';
import { Button } from '@/components/ui/button.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { ROUTES } from '@/constants/routes.js';

/**
 * Shared error screen. Status codes are set in the mono face at display
 * size — the code IS the headline, which is both honest and the fastest
 * thing to recognise. Every variant offers a way out; a dead end is a
 * design failure, not an error state.
 */
export function ErrorPage({
  code,
  title,
  description,
  action,
}: {
  code: string;
  title: string;
  description: string;
  action?: { label: string; to: string };
}) {
  useDocumentTitle(title);
  const target = action ?? { label: 'Back to dashboard', to: ROUTES.DASHBOARD };

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-6xl font-semibold tracking-tighter text-[var(--color-fg-subtle)]">
          {code}
        </p>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{description}</p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild>
            <Link to={target.to}>{target.label}</Link>
          </Button>
          <Button variant="secondary" onClick={() => window.history.back()}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      title="This page doesn't exist"
      description="The link may be out of date, or the page moved somewhere else."
      action={{ label: 'Back home', to: ROUTES.HOME }}
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      title="You don't have access to this"
      description="Your account doesn't have permission for this area. Ask an admin if you think that's wrong."
    />
  );
}

export function ServerErrorPage() {
  return (
    <ErrorPage
      code="500"
      title="The server ran into a problem"
      description="This one is on us. The team has been notified — try again in a few minutes."
      action={{ label: 'Back home', to: ROUTES.HOME }}
    />
  );
}
