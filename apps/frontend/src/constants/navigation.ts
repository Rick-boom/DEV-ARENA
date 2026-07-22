import { Code2, LayoutDashboard, Settings, Shield } from 'lucide-react';
import { UserRole } from '@/types/auth.types.js';
import { ROUTES } from './routes.js';
import type { NavEntry } from '@/types/ui.types.js';

/**
 * The sidebar as data. Adding a destination is a row here rather than
 * JSX edits in three components, and `roles` keeps visibility rules
 * beside the entry they govern.
 *
 * Battle and AI destinations are intentionally absent — those features
 * are out of scope.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { label: 'Dashboard', to: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: 'Problems', to: ROUTES.PROBLEMS, icon: Code2 },
  { label: 'Settings', to: ROUTES.SETTINGS, icon: Settings },
];

export const ADMIN_NAV: NavEntry[] = [
  {
    label: 'Moderation',
    to: ROUTES.DASHBOARD,
    icon: Shield,
    roles: [UserRole.ADMIN, UserRole.MODERATOR],
  },
];

/** Filters entries the current role may not see. */
export function visibleNav(entries: NavEntry[], role: UserRole | undefined): NavEntry[] {
  return entries.filter((entry) => !entry.roles || (role && entry.roles.includes(role)));
}
