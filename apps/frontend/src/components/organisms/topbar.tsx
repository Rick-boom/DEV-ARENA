import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { ThemeToggle } from '@/components/molecules/theme-toggle.js';
import { UserMenu } from '@/components/molecules/user-menu.js';

/**
 * Topbar (organism) — the in-app header for signed-in screens. Holds the
 * mobile nav trigger, the page heading slot, and account controls.
 * Sticky so the account menu and theme toggle stay reachable while
 * scrolling long pages.
 */
export function Topbar({ title, onMenuClick }: { title?: string; onMenuClick: () => void }) {
  return (
    <header
      className={[
        'sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6',
        'border-b border-[var(--color-border)] bg-[var(--color-canvas)]/85 backdrop-blur-md',
      ].join(' ')}
    >
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      {title ? (
        <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
