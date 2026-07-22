import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useVerifyEmailMutation } from '@/store/api/auth-api.js';
import { useAppDispatch } from '@/store/hooks.js';
import { userUpdated } from '@/store/slices/auth-slice.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { ROUTES } from '@/constants/routes.js';
import type { NormalizedError } from '@/types/api.types.js';

type Status = 'verifying' | 'verified' | 'failed';

/**
 * Email verification landing page. The token comes from the emailed
 * link, so this route verifies on mount and reports the outcome — there
 * is nothing for the user to fill in.
 *
 * The ref guard matters: React StrictMode double-invokes effects in dev,
 * and single-use tokens fail the second time, which would show a false
 * error on a perfectly good link.
 */
export function VerifyEmailPage() {
  useDocumentTitle('Verify email');
  const [params] = useSearchParams();
  const token = params.get('token');
  const dispatch = useAppDispatch();
  const [verifyEmail] = useVerifyEmailMutation();
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'failed');
  const [message, setMessage] = useState('This link is missing its verification token.');
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        await verifyEmail({ token }).unwrap();
        dispatch(userUpdated({ emailVerified: true }));
        setStatus('verified');
      } catch (error) {
        setMessage((error as NormalizedError).message);
        setStatus('failed');
      }
    })();
  }, [token, verifyEmail, dispatch]);

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner size="lg" label="Verifying your email" />
        <p className="text-sm text-[var(--color-fg-muted)]">Verifying your email…</p>
      </div>
    );
  }

  const verified = status === 'verified';
  const Icon = verified ? CheckCircle2 : XCircle;

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span
        className={`grid h-12 w-12 place-items-center rounded-xl ${
          verified ? 'bg-[var(--color-success)]/12' : 'bg-[var(--color-danger-subtle)]'
        }`}
      >
        <Icon
          className={`h-6 w-6 ${verified ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
          aria-hidden="true"
        />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {verified ? 'Email verified' : "That link didn't work"}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          {verified ? 'Your account is fully set up. Time to compete.' : message}
        </p>
      </div>
      <Button asChild full>
        <Link to={verified ? ROUTES.DASHBOARD : ROUTES.LOGIN}>
          {verified ? 'Go to dashboard' : 'Back to sign in'}
        </Link>
      </Button>
    </div>
  );
}
