import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

/**
 * ErrorBoundary. React only surfaces render-phase crashes to class
 * components, so this stays a class by necessity — there is no hook
 * equivalent.
 *
 * It renders a RECOVERY path, not just an apology: reset the boundary
 * (re-mounts the subtree) or reload. Placed per-layout rather than once
 * at the root so a crash in the page area doesn't take the navigation
 * down with it — the user can still get somewhere else.
 */
interface Props {
  children: ReactNode;
  /** changing this value resets the boundary — pass the route path */
  resetKey?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidUpdate(prev: Props): void {
    // Navigating away from a crashed screen should clear the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Hook for the error reporter (Sentry et al.) in production.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div role="alert" className="grid min-h-[60vh] place-items-center px-6">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-danger-subtle)]">
            <AlertTriangle className="h-6 w-6 text-[var(--color-danger)]" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">This screen stopped working</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            The rest of the app is fine. Try again, or reload if it keeps happening.
          </p>
          <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left font-mono text-[11px] break-words text-[var(--color-fg-subtle)]">
            {error.message}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={this.reset}>
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
