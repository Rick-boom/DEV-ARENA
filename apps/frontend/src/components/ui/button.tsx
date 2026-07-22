import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import type { VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn.js';
import { buttonVariants } from './button-variants.js';

/**
 * Button (atom). Styling lives in `button-variants.ts`; this file owns
 * behaviour only — the loading state, disabled handling, and `asChild`.
 *
 * `asChild` lets a Link render with button styling without nesting an
 * <a> inside a <button>, which would be invalid and break keyboard nav.
 */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    full,
    asChild = false,
    loading = false,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, full }), className)}
      disabled={disabled ?? loading}
      // Tells assistive tech the control is busy rather than broken.
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});
