import { Link, NavLink } from 'react-router';

/** Top navigation. The wordmark's double-slash is the brand mark. */
export function Nav() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors ${isActive ? 'text-fg' : 'text-muted hover:text-fg'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="font-display text-sm font-bold tracking-wide text-fg">
          DEV<span style={{ color: 'var(--color-cyan)' }}>//</span>ARENA
        </Link>
        <div className="hidden items-center gap-7 sm:flex">
          <NavLink to="/problems" className={link}>
            Problems
          </NavLink>
          <NavLink to="/arena" className={link}>
            Battles
          </NavLink>
          <a href="#corner" className="text-sm text-muted transition-colors hover:text-fg">
            Leaderboard
          </a>
        </div>
        <Link
          to="/arena"
          className="rounded-md px-3.5 py-1.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
          style={{ background: 'var(--color-gold)' }}
        >
          Enter arena
        </Link>
      </nav>
    </header>
  );
}
