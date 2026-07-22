import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with correct precedence. `clsx` handles
 * conditionals; `twMerge` resolves conflicts so a caller's `px-6` beats
 * a component's default `px-4` instead of both landing in the DOM.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
