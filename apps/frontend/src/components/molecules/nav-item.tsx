import { NavLink } from 'react-router';
import { cn } from '@/utils/cn.js';
import { Badge } from '@/components/ui/badge.js';
import type { NavEntry } from '@/types/ui.types.js';

/**
 * Sidebar entry (molecule). NavLink supplies `isActive`, and we mark the
 * active item with aria-current="page" so screen readers announce the
 * current location rather than relying on colour alone.
 */
export function NavItem({ entry, collapsed }: { entry: NavEntry; collapsed: boolean }) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      title={collapsed ? entry.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
            : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-fg)]',
        )
      }
      aria-current={undefined}
    >
      {({ isActive }) => (
        <>
          {/* Active rail: a 2px marker so state survives colour-blindness. */}
          {isActive ? (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -left-2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
            />
          ) : null}
          <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
          {!collapsed ? (
            <>
              <span className="flex-1 truncate">{entry.label}</span>
              {entry.badge ? <Badge variant="neutral">{entry.badge}</Badge> : null}
            </>
          ) : (
            <span className="sr-only">{entry.label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}
