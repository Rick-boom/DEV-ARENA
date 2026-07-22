import { useState } from 'react';
import { Link } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Alert } from '@/components/ui/alert.js';
import { FormField } from '@/components/molecules/form-field.js';
import { PasswordInput, PasswordStrength } from '@/components/molecules/password-input.js';
import { OAuthButtons } from '@/components/molecules/oauth-buttons.js';
import { useAuth } from '@/hooks/use-auth.js';
import { ROUTES } from '@/constants/routes.js';
import { NotificationVariant } from '@/types/ui.types.js';
import { toFieldErrors } from '@/utils/error.js';
import { signupSchema, type SignupValues } from '../schemas/auth-schemas.js';

/**
 * Signup form. Validates on blur rather than on every keystroke — being
 * told your email is invalid while you're still typing it is hostile.
 * The strength meter is the exception: it reacts live because it's
 * guidance, not judgement.
 */
export function SignupForm() {
  const { signup } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as true,
    },
  });

  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const error = await signup({
      username: values.username,
      email: values.email,
      password: values.password,
    });
    if (!error) return;

    const fieldErrors = toFieldErrors(error);
    if (fieldErrors.length) {
      fieldErrors.forEach(([field, message]) => setError(field as keyof SignupValues, { message }));
      return;
    }
    setFormError(error.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert variant={NotificationVariant.ERROR}>{formError}</Alert> : null}

      <FormField
        label="Username"
        error={errors.username?.message}
        hint="This is how you'll appear on leaderboards."
        required
      >
        {(field) => (
          <Input
            {...field}
            {...register('username')}
            autoComplete="username"
            placeholder="ada_lovelace"
            invalid={Boolean(errors.username)}
            autoFocus
          />
        )}
      </FormField>

      <FormField label="Email" error={errors.email?.message} required>
        {(field) => (
          <Input
            {...field}
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            invalid={Boolean(errors.email)}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-2">
        <FormField label="Password" error={errors.password?.message} required>
          {(field) => (
            <PasswordInput
              {...field}
              {...register('password')}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              invalid={Boolean(errors.password)}
            />
          )}
        </FormField>
        <PasswordStrength value={password ?? ''} />
      </div>

      <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
        {(field) => (
          <PasswordInput
            {...field}
            {...register('confirmPassword')}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            invalid={Boolean(errors.confirmPassword)}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-[var(--color-fg-muted)]">
          <Checkbox {...register('acceptTerms')} className="mt-0.5" />
          <span>I agree to the terms of service and privacy policy.</span>
        </label>
        {errors.acceptTerms ? (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {errors.acceptTerms.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" full loading={isSubmitting}>
        Create account
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
        Already have an account?{' '}
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
