import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useResendVerificationMutation } from '@/store/api/auth-api.js';
import { useNotify } from '@/hooks/use-notify.js';
import { useAppSelector } from '@/store/hooks.js';
import { selectUser } from '@/store/selectors.js';

/**
 * Persistent banner for unverified accounts. It nags rather than blocks:
 * locking an unverified user out of the whole app would strand anyone
 * whose verification email is slow or filtered. Dismissible for the
 * session so it doesn't become noise.
 */
export function EmailVerificationNotice() {
  const user = useAppSelector(selectUser);
  const notify = useNotify();
  const [resend, { isLoading }] = useResendVerificationMutation();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  const handleResend = async (): Promise<void> => {
    try {
      await resend().unwrap();
      notify.success('Verification sent', `Check ${user.email} for the link.`);
    } catch {
      notify.error('Could not send the email', 'Try again in a minute.');
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 border-b border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-2.5 sm:px-6"
    >
      <MailWarning className="h-4 w-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
      <p className="text-[13px] text-[var(--color-fg)]">
        Verify your email to join ranked battles.
      </p>
      <div className="ml-auto flex gap-2">
        <Button variant="ghost" size="sm" onClick={handleResend} loading={isLoading}>
          Resend link
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
