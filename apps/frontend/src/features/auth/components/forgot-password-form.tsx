import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Alert } from '@/components/ui/alert.js';
import { FormField } from '@/components/molecules/form-field.js';
import { useForgotPasswordMutation } from '@/store/api/auth-api.js';
import { ROUTES } from '@/constants/routes.js';
import { NotificationVariant } from '@/types/ui.types.js';
import type { NormalizedError } from '@/types/api.types.js';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas/auth-schemas.js';

/**
 * Forgot-password request.
 *
 * The success state deliberately does NOT confirm whether the address
 * exists — saying "no account found" would turn this form into an
 * account-enumeration oracle. Same message either way.
 */
export function ForgotPasswordForm() {
  const [forgotPassword] = useForgotPasswordMutation();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await forgotPassword(values).unwrap();
      setSent(true);
    } catch (error) {
      // Rate limiting is the one failure worth surfacing here.
      const normalized = error as NormalizedError;
      if (normalized.status === 429) setFormError(normalized.message);
      else setSent(true);
    }
  });

  if (sent) {
    return (
      <div className="flex flex-col gap-5 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-accent-subtle)]">
          <MailCheck className="h-6 w-6 text-[var(--color-accent)]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Check your inbox</h2>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            If an account exists for{' '}
            <span className="font-mono text-[var(--color-fg)]">{getValues('email')}</span>, we sent
            a reset link. It expires in 30 minutes.
          </p>
        </div>
        <Button variant="secondary" asChild full>
          <Link to={ROUTES.LOGIN}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert variant={NotificationVariant.ERROR}>{formError}</Alert> : null}

      <FormField
        label="Email"
        error={errors.email?.message}
        hint="We'll send a reset link to this address."
        required
      >
        {(field) => (
          <Input
            {...field}
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            invalid={Boolean(errors.email)}
            autoFocus
          />
        )}
      </FormField>

      <Button type="submit" full loading={isSubmitting}>
        Send reset link
      </Button>

      <p className="text-center text-[13px] text-[var(--color-fg-muted)]">
        Remembered it?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
