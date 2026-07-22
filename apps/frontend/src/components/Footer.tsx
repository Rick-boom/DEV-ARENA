export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center">
        <span className="font-display text-xs font-bold tracking-wide text-fg">
          DEV<span style={{ color: 'var(--color-cyan)' }}>//</span>ARENA
        </span>
        <span>Built by Rick, Sourav &amp; Anshu · 2026</span>
        <span className="font-mono text-xs">judge median 96 ms · uptime 99.98%</span>
      </div>
    </footer>
  );
}
