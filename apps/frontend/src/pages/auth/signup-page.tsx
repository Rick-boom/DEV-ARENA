import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { SignupForm } from '@/features/auth/components/signup-form.js';

/** Route: Create account. */
export function SignupPage() {
  useDocumentTitle('Create account');
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Start competing in ranked matches today.
        </p>
      </header>
      <SignupForm />
    </div>
  );
}
