import { APP } from '@/constants/app.js';

/**
 * Footer (organism). Deliberately minimal: on a product shell the footer
 * is orientation, not a second navigation. Uses the mono face for the
 * meta line, consistent with how the rest of the app marks out data.
 */
export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
          {APP.NAME} — {APP.TAGLINE}
        </p>
        <nav aria-label="Footer" className="flex gap-5 text-[12px] text-[var(--color-fg-muted)]">
          <a href="#" className="rounded transition-colors hover:text-[var(--color-fg)]">
            Docs
          </a>
          <a href="#" className="rounded transition-colors hover:text-[var(--color-fg)]">
            Status
          </a>
          <a href="#" className="rounded transition-colors hover:text-[var(--color-fg)]">
            Privacy
          </a>
        </nav>
      </div>
    </footer>
  );
}
