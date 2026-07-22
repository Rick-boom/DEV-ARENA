import { AnimatePresence, motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Logo } from '@/components/molecules/logo.js';
import { NavItem } from '@/components/molecules/nav-item.js';
import { Button } from '@/components/ui/button.js';
import { ADMIN_NAV, PRIMARY_NAV, visibleNav } from '@/constants/navigation.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectSidebarCollapsed, selectUser } from '@/store/selectors.js';
import { sidebarToggled } from '@/store/slices/user-slice.js';
import { cn } from '@/utils/cn.js';

/**
 * Sidebar (organism). One component serves two presentations: a
 * collapsible rail on desktop and a slide-over drawer on mobile. Sharing
 * the nav list keeps the two from drifting.
 *
 * The mobile drawer is a modal dialog — labelled, dismissible with
 * Escape, and backed by a scrim that closes on click.
 */
export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const user = useAppSelector(selectUser);

  const primary = visibleNav(PRIMARY_NAV, user?.role);
  const admin = visibleNav(ADMIN_NAV, user?.role);

  const nav = (isCollapsed: boolean) => (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 py-4">
      {primary.map((entry) => (
        <NavItem key={entry.label} entry={entry} collapsed={isCollapsed} />
      ))}

      {admin.length ? (
        <>
          <p
            className={cn(
              'mt-5 mb-1 px-2.5 font-mono text-[10px] tracking-widest text-[var(--color-fg-subtle)] uppercase',
              isCollapsed && 'sr-only',
            )}
          >
            Staff
          </p>
          {admin.map((entry) => (
            <NavItem key={entry.label} entry={entry} collapsed={isCollapsed} />
          ))}
        </>
      ) : null}
    </nav>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex',
          'transition-[width] duration-200 ease-[var(--ease-out-expo)]',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-[var(--color-border)] px-4',
            collapsed && 'justify-center px-2',
          )}
        >
          <Logo showWordmark={!collapsed} />
        </div>

        {nav(collapsed)}

        <div className="border-t border-[var(--color-border)] p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={() => dispatch(sidebarToggled())}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') onMobileClose();
              }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:hidden"
            >
              <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
                <Logo />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onMobileClose}
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div onClick={onMobileClose}>{nav(false)}</div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
