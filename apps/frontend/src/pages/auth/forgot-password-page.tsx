import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form.js';

/** Route: Reset password. */
export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Enter your email and we\u2019ll send you a reset link.
        </p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}
