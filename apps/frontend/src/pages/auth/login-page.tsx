import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { LoginForm } from '@/features/auth/components/login-form.js';

/** Route: Sign in. */
export function LoginPage() {
  useDocumentTitle('Sign in');
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">Pick up where you left off.</p>
      </header>
      <LoginForm />
    </div>
  );
}
