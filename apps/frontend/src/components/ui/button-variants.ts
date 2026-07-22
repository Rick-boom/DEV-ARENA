import { cva } from 'class-variance-authority';

/**
 * Button style table. Variants are data, not conditionals — adding a
 * style is a new row, and the prop union is derived from it. Kept in its
 * own module so the component file exports only a component.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg',
    'font-medium transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]',
        secondary:
          'bg-[var(--color-elevated)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
        ghost:
          'text-[var(--color-fg-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-fg)]',
        danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
        link: 'text-[var(--color-accent)] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-9 w-9 p-0',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);
