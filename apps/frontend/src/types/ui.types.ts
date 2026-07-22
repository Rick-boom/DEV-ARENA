import type { LucideIcon } from 'lucide-react';
import type { UserRole } from './auth.types.js';

export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

/** Resolved theme actually applied to the DOM (system → light|dark). */
export type ResolvedTheme = 'light' | 'dark';

export const NotificationVariant = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
} as const;
export type NotificationVariant = (typeof NotificationVariant)[keyof typeof NotificationVariant];

export interface Notification {
  id: string;
  variant: NotificationVariant;
  title: string;
  description?: string;
  /** ms before auto-dismiss; 0 keeps it until dismissed */
  duration: number;
}

/** A sidebar/nav entry. `roles` gates visibility without a separate config. */
export interface NavEntry {
  label: string;
  to: string;
  icon: LucideIcon;
  roles?: UserRole[];
  badge?: string;
}
