import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Alert } from '@/components/ui/alert.js';
import { FormField } from '@/components/molecules/form-field.js';
import { PasswordInput } from '@/components/molecules/password-input.js';
import { OAuthButtons } from '@/components/molecules/oauth-buttons.js';
import { useAuth } from '@/hooks/use-auth.js';
import { ROUTES } from '@/constants/routes.js';
import { NotificationVariant } from '@/types/ui.types.js';
import { toFieldErrors } from '@/utils/error.js';
import { loginSchema, type LoginValues } from '../schemas/auth-schemas.js';

/**
 * Login form. Validation is Zod via the RHF resolver, so the rules live
 * in one schema instead of being restated in JSX.
 *
 * Server errors are split: field-level details map onto the offending
 * input, and anything else becomes one banner. That way "wrong password"
 * appears under the password box rather than as a vague notice.
 */
export function LoginForm() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const error = await login(values);
    if (!error) return;

    const fieldErrors = toFieldErrors(error);
    if (fieldErrors.length) {
      fieldErrors.forEach(([field, message]) => setError(field as keyof LoginValues, { message }));
      return;
    }
    setFormError(error.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert variant={NotificationVariant.ERROR}>{formError}</Alert> : null}

      <FormField label="Email" error={errors.email?.message} required>
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

      <FormField label="Password" error={errors.password?.message} required>
        {(field) => (
          <PasswordInput
            {...field}
            {...register('password')}
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={Boolean(errors.password)}
          />
        )}
      </FormField>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-fg-muted)]">
          <Checkbox {...register('rememberMe')} />
          Keep me signed in
        </label>
        <Link
          to={ROUTES.FORGOT_PASSWORD}
          className="text-[13px] text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" full loading={isSubmitting}>
        Sign in
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="font-mono text-[11px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
          or
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <OAuthButtons disabled={isSubmitting} />

      <p className="text-center text-[13px] text-[var(--color-fg-muted)]">
        New to DevArena?{' '}
        <Link
          to={ROUTES.SIGNUP}
          className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
