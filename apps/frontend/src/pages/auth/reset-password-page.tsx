import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form.js';

/** Route: Set new password. */
export function ResetPasswordPage() {
  useDocumentTitle('Set new password');
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Pick something you haven\u2019t used before.
        </p>
      </header>
      <ResetPasswordForm />
    </div>
  );
}
