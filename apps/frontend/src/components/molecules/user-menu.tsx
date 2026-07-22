import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/avatar.js';
import { Badge } from '@/components/ui/badge.js';
import { useAuth } from '@/hooks/use-auth.js';
import { ROUTES } from '@/constants/routes.js';
import { cn } from '@/utils/cn.js';

const itemClass = cn(
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]',
  'text-[var(--color-fg-muted)] outline-none',
  'data-[highlighted]:bg-[var(--color-surface)] data-[highlighted]:text-[var(--color-fg)]',
);

/**
 * Account menu (molecule). Radix supplies the roving focus, Escape/arrow
 * handling and focus restoration — behaviour that is tedious to get
 * right by hand and easy to get subtly wrong.
 */
export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const displayName = user.displayName ?? user.username;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors',
          'hover:bg-[var(--color-elevated)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
        )}
        aria-label={`Account menu for ${displayName}`}
      >
        <Avatar src={user.avatarUrl} name={displayName} size={28} />
        <span className="hidden text-[13px] font-medium sm:inline">{displayName}</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            'z-50 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-1.5',
            'shadow-[var(--shadow-pop)]',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--color-fg)]">
                {displayName}
              </p>
              <p className="truncate text-xs text-[var(--color-fg-subtle)]">{user.email}</p>
            </div>
            <Badge variant="accent">{user.rating}</Badge>
          </div>

          <DropdownMenu.Separator className="my-1.5 h-px bg-[var(--color-border)]" />

          <DropdownMenu.Item asChild className={itemClass}>
            <Link to={ROUTES.DASHBOARD}>
              <UserIcon className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild className={itemClass}>
            <Link to={ROUTES.SETTINGS}>
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1.5 h-px bg-[var(--color-border)]" />

          <DropdownMenu.Item
            className={cn(
              itemClass,
              'text-[var(--color-danger)] data-[highlighted]:text-[var(--color-danger)]',
            )}
            onSelect={() => void logout()}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
