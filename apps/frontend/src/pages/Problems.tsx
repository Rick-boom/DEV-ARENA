import { useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { DIFFICULTY_COLOR, PROBLEMS, type ProblemRow } from '../data/problems';

const DIFFICULTIES = ['ALL', 'EASY', 'MEDIUM', 'HARD'] as const;
type DifficultyFilter = (typeof DIFFICULTIES)[number];

/**
 * Problem browser. Mirrors GET /api/v1/problems (same filters, same
 * DTO shape) with client-side mock data; wiring React Query to the
 * live endpoint replaces one useMemo.
 */
export function Problems() {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('ALL');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (difficulty !== 'ALL' && p.difficulty !== difficulty) return false;
      if (!keyword) return true;
      return (
        p.title.toLowerCase().includes(keyword) ||
        p.tags.some((t) => t.includes(keyword)) ||
        p.companies.some((c) => c.includes(keyword))
      );
    });
  }, [difficulty, q]);

  return (
    <div className="min-h-full">
      <Nav />
      <main className="mx-auto max-w-6xl px-5 py-14">
        <p className="font-mono text-xs tracking-[0.25em] text-muted">PROBLEM SET</p>
        <h1 className="mt-3 font-display text-3xl font-bold">Pick your fight</h1>

        {/* filters */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div
            className="flex overflow-hidden rounded-md border border-line"
            role="group"
            aria-label="difficulty filter"
          >
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`px-3.5 py-1.5 font-mono text-xs transition-colors ${
                  difficulty === d ? 'bg-panel-2 text-fg' : 'text-muted hover:text-fg'
                }`}
                aria-pressed={difficulty === d}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, tag or company…"
            className="w-64 rounded-md border border-line bg-panel px-3.5 py-1.5 text-sm placeholder:text-muted focus:border-muted"
            aria-label="Search problems"
          />
          <span className="ml-auto font-mono text-xs text-muted">
            {rows.length} / {PROBLEMS.length} problems
          </span>
        </div>

        {/* table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[1.6fr_1fr_1fr_auto] gap-4 border-b border-line bg-panel-2 px-5 py-2.5 font-mono text-[11px] tracking-wide text-muted sm:grid">
            <span>PROBLEM</span>
            <span>TAGS</span>
            <span>ACCEPTANCE</span>
            <span>DIFFICULTY</span>
          </div>
          {rows.length === 0 ? (
            <div className="bg-panel px-5 py-14 text-center text-sm text-muted">
              No problems match. Clear the search or pick another difficulty.
            </div>
          ) : (
            rows.map((p) => <Row key={p.id} p={p} />)
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ p }: { p: ProblemRow }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line bg-panel px-5 py-4 transition-colors last:border-b-0 hover:bg-panel-2 sm:grid-cols-[1.6fr_1fr_1fr_auto]">
      <span className="flex items-center gap-3">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: p.isSolved ? 'var(--color-green)' : 'var(--color-line)' }}
          aria-label={p.isSolved ? 'solved' : 'unsolved'}
        />
        <span>
          <span className="block text-sm font-medium">{p.title}</span>
          <span className="mt-0.5 block font-mono text-[11px] text-muted sm:hidden">
            {p.tags.join(' · ')}
          </span>
        </span>
      </span>
      <span className="hidden font-mono text-xs text-muted sm:block">{p.tags.join(' · ')}</span>
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
    </div>
  );
}
