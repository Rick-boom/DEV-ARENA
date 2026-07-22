import { Link, Outlet } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Logo } from '@/components/molecules/logo.js';
import { ThemeToggle } from '@/components/molecules/theme-toggle.js';
import { PageTransition } from '@/components/organisms/page-transition.js';
import { ROUTES } from '@/constants/routes.js';

/**
 * Auth layout: form on the left, context on the right.
 *
 * The right panel is the signature of this shell — a live "match ticker"
 * in the mono face. It exists because the thing DevArena actually is
 * (people beating each other at algorithms in real time) is more
 * persuasive than a stock illustration, and it costs one column of text.
 * It's hidden below `lg` where the form deserves the full width, and it
 * freezes entirely under prefers-reduced-motion.
 */
const TICKER: { user: string; verdict: string; detail: string; tone: string }[] = [
  { user: 'ada_l', verdict: 'AC', detail: 'Two Sum · 42ms', tone: 'text-[var(--color-success)]' },
  {
    user: 'k_rust',
    verdict: 'WA',
    detail: 'Median Streams · case 7',
    tone: 'text-[var(--color-danger)]',
  },
  {
    user: 'sourav',
    verdict: 'AC',
    detail: 'LRU Cache · 91ms',
    tone: 'text-[var(--color-success)]',
  },
  {
    user: 'm_hopper',
    verdict: 'TLE',
    detail: 'N-Queens · 2000ms',
    tone: 'text-[var(--color-warning)]',
  },
  {
    user: 'anshu',
    verdict: 'AC',
    detail: 'Word Ladder · 128ms',
    tone: 'text-[var(--color-success)]',
  },
];

export function AuthLayout() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Form column */}
      <div className="flex flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link to={ROUTES.HOME} className="rounded-md" aria-label="DevArena home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>

        <p className="text-center font-mono text-[11px] text-[var(--color-fg-subtle)]">
          Protected by rate limiting and email verification.
        </p>
      </div>

      {/* Context column — the signature */}
      <aside className="relative hidden overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
        <div className="grid-hairline absolute inset-0" aria-hidden="true" />

        <div className="relative flex h-full flex-col justify-center px-12 xl:px-16">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)] uppercase">
            Live now
          </p>
          <h2 className="mt-4 max-w-md text-3xl leading-[1.15] font-semibold tracking-tight text-balance">
            Every submission is a move against someone else&apos;s clock.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-[var(--color-fg-muted)]">
            Ranked 1v1 matches, a real judge, and a rating that moves after every battle.
          </p>

          <ul className="mt-10 flex max-w-md flex-col gap-px overflow-hidden rounded-xl border border-[var(--color-border)]">
            {TICKER.map((row, index) => (
              <motion.li
                key={row.user}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.4 + index * 0.09, duration: 0.4 }}
                className="flex items-center gap-3 bg-[var(--color-elevated)] px-4 py-2.5 font-mono text-[12px]"
              >
                <span className={`w-8 font-semibold ${row.tone}`}>{row.verdict}</span>
                <span className="text-[var(--color-fg)]">{row.user}</span>
                <span className="ml-auto truncate text-[var(--color-fg-subtle)]">{row.detail}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
