import { z } from 'zod';

/**
 * Validation schemas. These are the single source of truth for form
 * rules AND for the TypeScript types the forms use — `z.infer` means the
 * two can never drift apart.
 *
 * Messages are written as instructions ("Use at least 8 characters"),
 * not verdicts ("Invalid password"), so the user knows what to do next.
 */
const email = z
  .string()
  .min(1, 'Enter your email address')
  .email('That does not look like an email address');

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Keep it under 128 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include a capital letter')
  .regex(/\d/, 'Include a number');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
});

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Use at least 3 characters')
      .max(24, 'Keep it under 24 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    email,
    password,
    confirmPassword: z.string().min(1, 'Re-enter your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Accept the terms to continue' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, 'Re-enter your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
