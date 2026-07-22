import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button.js';
import { Alert } from '@/components/ui/alert.js';
import { FormField } from '@/components/molecules/form-field.js';
import { PasswordInput, PasswordStrength } from '@/components/molecules/password-input.js';
import { useResetPasswordMutation } from '@/store/api/auth-api.js';
import { useNotify } from '@/hooks/use-notify.js';
import { ROUTES } from '@/constants/routes.js';
import { NotificationVariant } from '@/types/ui.types.js';
import type { NormalizedError } from '@/types/api.types.js';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas/auth-schemas.js';

/**
 * Reset-password form. The token arrives in the query string; a missing
 * one is caught before the form renders so the user gets a clear route
 * forward instead of a request that was always going to fail.
 */
export function ResetPasswordForm() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const notify = useNotify();
  const [resetPassword] = useResetPasswordMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = useWatch({ control, name: 'password' });

  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant={NotificationVariant.ERROR} title="This reset link is incomplete">
          Request a new link and open it directly from your email.
        </Alert>
        <Button variant="secondary" asChild full>
          <Link to={ROUTES.FORGOT_PASSWORD}>Request a new link</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetPassword({ token, password: values.password }).unwrap();
      notify.success('Password updated', 'Sign in with your new password.');
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      setFormError((error as NormalizedError).message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert variant={NotificationVariant.ERROR}>{formError}</Alert> : null}

      <div className="flex flex-col gap-2">
        <FormField label="New password" error={errors.password?.message} required>
          {(field) => (
            <PasswordInput
              {...field}
              {...register('password')}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              invalid={Boolean(errors.password)}
              autoFocus
            />
          )}
        </FormField>
        <PasswordStrength value={password ?? ''} />
      </div>

      <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
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

      <Button type="submit" full loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
