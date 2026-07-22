import { Suspense, lazy } from 'react';
import { Link } from 'react-router';

const ArenaField = lazy(() =>
  import('../components/ArenaField').then((m) => ({ default: m.ArenaField })),
);
import { BattleReplay } from '../components/BattleReplay';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { DIFFICULTY_COLOR, PROBLEMS } from '../data/problems';

const TICKER_ITEMS = [
  'ryu_dev defeated null_ptr · two-sum · +24',
  'battle #48212 started · lru-cache · 1v1',
  'aki_codes ACCEPTED · word-ladder · 312 ms',
  'sourav_x rating 1602 → 1631',
  'interview room opened · graphs · 3 seats',
  'anshu.dev ACCEPTED · merge-intervals · 88 ms',
];

const PHASES = [
  ['Queue', 'Matchmaking pairs you by rating, ±75 Elo. No smurfing past the judge.'],
  ['Lock', 'Both sides receive the same sealed problem at the same millisecond.'],
  ['Solve', 'Your editor, their cursor ghosts. Every keystroke syncs conflict-free.'],
  ['Verdict', 'Hidden test cases in a sandboxed judge. Median call: 96 ms.'],
  ['Rating', 'Elo moves and it stays moved. History is permanent.'],
] as const;

const CORNER = [
  {
    title: 'AI coach',
    body: 'Progressive hints that unlock one at a time and never spoil the answer. Trained to nudge, not solve.',
    accent: 'var(--color-cyan)',
    demo: (
      <div className="font-mono text-[11px] leading-relaxed text-muted">
        <p className="text-fg">hint 1 / 3</p>
        <p className="mt-1">&gt; What do you know about the complement of nums[i]?</p>
        <p className="mt-2 opacity-40">hint 2 / 3 — locked until you try again</p>
      </div>
    ),
  },
  {
    title: 'Live share',
    body: 'Multiplayer editing on CRDTs — cursors, selections and presence for interviews and pair grinding.',
    accent: 'var(--color-red)',
    demo: (
      <div className="font-mono text-[11px] leading-relaxed">
        <p>
          <span className="text-muted">const seen = </span>
          <span
            className="rounded px-0.5"
            style={{ background: 'color-mix(in srgb, var(--color-red) 30%, transparent)' }}
          >
            new Map()
          </span>
          <span
            className="ml-1 rounded-sm px-1 text-[9px] text-ink"
            style={{ background: 'var(--color-red)' }}
          >
            null_ptr
          </span>
        </p>
        <p className="mt-1.5">
          <span className="text-muted">for (const n of nums)</span>
          <span className="caret" style={{ color: 'var(--color-cyan)' }} />
          <span
            className="ml-1 rounded-sm px-1 text-[9px] text-ink"
            style={{ background: 'var(--color-cyan)' }}
          >
            you
          </span>
        </p>
      </div>
    ),
  },
  {
    title: 'The judge',
    body: 'Every submission runs in a fresh, network-less container. Four languages. It kills infinite loops for sport.',
    accent: 'var(--color-gold)',
    demo: (
      <div className="font-mono text-[11px] leading-relaxed text-muted">
        <p>
          cpp · java · python · js <span className="text-fg">→ sandbox</span>
        </p>
        <p className="mt-1">
          8/8 tests · <span style={{ color: 'var(--color-green)' }}>ACCEPTED</span> · 96 ms · 3.2 MB
        </p>
      </div>
    ),
  },
];

export function Landing() {
  return (
    <div className="min-h-full">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <Suspense fallback={null}>
          <ArenaField />
        </Suspense>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(60% 60% at 50% 40%, transparent 0%, var(--color-ink) 78%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
          <div className="rise">
            <p className="font-mono text-xs tracking-[0.25em] text-muted">
              COMPETITIVE PROGRAMMING · LIVE
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] sm:text-5xl">
              Code is a<br />
              spectator
              <span style={{ color: 'var(--color-gold)' }}> sport</span>.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              Get matched by rating, solve the same problem as your opponent in real time, and let
              the judge call it in milliseconds — with an AI coach in your corner.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/arena"
                className="rounded-md px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
                style={{ background: 'var(--color-gold)' }}
              >
                Enter the arena
              </Link>
              <Link
                to="/problems"
                className="rounded-md border border-line px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-muted"
              >
                Browse problems
              </Link>
            </div>
            <p className="mt-8 font-mono text-xs text-muted">
              2,400+ ranked problems · Elo-rated 1v1 · 4 languages
            </p>
          </div>

          <div
            className="rise flex justify-center lg:justify-end"
            style={{ animationDelay: '150ms' }}
          >
            <BattleReplay />
          </div>
        </div>

        {/* live ticker */}
        <div className="relative border-y border-line bg-panel/60 py-2.5" aria-hidden>
          <div className="ticker flex w-max gap-10 whitespace-nowrap font-mono text-xs text-muted">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i}>
                <span style={{ color: 'var(--color-cyan)' }}>▸</span> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANATOMY OF A BATTLE ──────────────────────────────────── */}
      <section id="battle" className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Anatomy of a battle</h2>
        <p className="mt-3 max-w-lg text-muted">
          Five phases, one winner. The order below is the actual match pipeline — every battle you
          watch or play runs through it.
        </p>
        <ol className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
          {PHASES.map(([name, body], i) => (
            <li key={name} className="group bg-panel p-5 transition-colors hover:bg-panel-2">
              <span className="font-mono text-xs" style={{ color: 'var(--color-cyan)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 font-display text-sm font-bold tracking-wide">{name}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── YOUR CORNER ──────────────────────────────────────────── */}
      <section id="corner" className="border-y border-line bg-panel/40">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Your corner</h2>
          <p className="mt-3 max-w-lg text-muted">Three things stand behind you in every match.</p>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {CORNER.map((f) => (
              <article
                key={f.title}
                className="rounded-xl border border-line bg-panel p-6 transition-transform hover:-translate-y-1"
                style={{ boxShadow: `inset 0 2px 0 0 ${f.accent}` }}
              >
                <h3 className="font-display text-base font-bold">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.body}</p>
                <div className="mt-5 rounded-lg border border-line bg-ink p-4">{f.demo}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEMS STRIP ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Tonight&apos;s card</h2>
            <p className="mt-3 text-muted">The most-fought problems this week.</p>
          </div>
          <Link
            to="/problems"
            className="hidden text-sm font-semibold sm:block"
            style={{ color: 'var(--color-cyan)' }}
          >
            Browse all →
          </Link>
        </div>
        <div className="mt-8 overflow-hidden rounded-xl border border-line">
          {PROBLEMS.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              to="/problems"
              className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line bg-panel px-5 py-4 transition-colors last:border-b-0 hover:bg-panel-2 sm:grid-cols-[1.6fr_1fr_1fr_auto]"
            >
              <span className="flex items-center gap-3">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: p.isSolved ? 'var(--color-green)' : 'var(--color-line)' }}
                  aria-label={p.isSolved ? 'solved' : 'unsolved'}
                />
                <span className="text-sm font-medium">{p.title}</span>
              </span>
              <span className="hidden font-mono text-xs text-muted sm:block">
                {p.tags.join(' · ')}
              </span>
              <span className="hidden items-center gap-2 sm:flex">
                <span className="h-1 w-24 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${p.acceptanceRate}%`, background: 'var(--color-gold)' }}
                  />
                </span>
                <span className="font-mono text-xs text-muted">{p.acceptanceRate}%</span>
              </span>
              <span
                className="justify-self-end font-mono text-xs font-semibold"
                style={{ color: DIFFICULTY_COLOR[p.difficulty] }}
              >
                {p.difficulty}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section id="cta" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Your rating is <span style={{ color: 'var(--color-gold)' }}>waiting</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Everyone starts at 1200. Where it goes from there is between you and the judge.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a
              href="#"
              className="rounded-md px-6 py-3 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              style={{ background: 'var(--color-gold)' }}
            >
              Create an account
            </a>
            <Link
              to="/arena"
              className="rounded-md border border-line px-6 py-3 text-sm font-semibold transition-colors hover:border-muted"
            >
              Play a live battle
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
