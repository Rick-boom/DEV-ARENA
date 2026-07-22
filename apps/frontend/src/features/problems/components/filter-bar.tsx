import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectActiveFilterCount, selectProblemQuery } from '@/store/selectors.js';
import {
  companyToggled,
  difficultyToggled,
  filtersCleared,
  searchChanged,
  sortChanged,
  statusChanged,
  tagToggled,
} from '@/store/slices/problem-slice.js';
import { useGetFacetsQuery } from '@/store/api/problem-api.js';
import { DIFFICULTY_META, SORT_LABELS, STATUS_LABELS } from '@/constants/problems.js';
import { Difficulty, ProblemSort, SolvedFilter } from '@/types/problem.types.js';
import { cn } from '@/utils/cn.js';

/**
 * Explorer filters.
 *
 * Search is debounced locally before it reaches Redux — every keystroke
 * dispatching would refire the query and make typing feel laggy. The
 * input stays controlled by local state so it remains responsive while
 * the network settles.
 */
export function FilterBar() {
  const dispatch = useAppDispatch();
  const query = useAppSelector(selectProblemQuery);
  const activeCount = useAppSelector(selectActiveFilterCount);
  const { data: facets } = useGetFacetsQuery();
  const [searchDraft, setSearchDraft] = useState(query.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDraft !== query.search) dispatch(searchChanged(searchDraft));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft, query.search, dispatch]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-subtle)]"
            aria-hidden="true"
          />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search problems"
            aria-label="Search problems"
            className="pl-9"
          />
        </div>

        <label className="sr-only" htmlFor="status-filter">
          Status
        </label>
        <select
          id="status-filter"
          value={query.status}
          onChange={(event) => dispatch(statusChanged(event.target.value as SolvedFilter))}
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
        >
          {Object.values(SolvedFilter).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="sort-filter">
          Sort by
        </label>
        <select
          id="sort-filter"
          value={query.sort}
          onChange={(event) => dispatch(sortChanged(event.target.value as ProblemSort))}
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
        >
          {Object.values(ProblemSort).map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </select>

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchDraft('');
              dispatch(filtersCleared());
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear ({activeCount})
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Difficulty">
        {Object.values(Difficulty).map((difficulty) => {
          const active = query.difficulties.includes(difficulty);
          return (
            <button
              key={difficulty}
              type="button"
              onClick={() => dispatch(difficultyToggled(difficulty))}
              aria-pressed={active}
              className={cn(
                'rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors',
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
              )}
            >
              {DIFFICULTY_META[difficulty].label}
            </button>
          );
        })}
      </div>

      {facets?.tags.length ? (
        <FacetRow
          label="Topics"
          values={facets.tags.slice(0, 12)}
          selected={query.tags}
          onToggle={(value) => dispatch(tagToggled(value))}
        />
      ) : null}

      {facets?.companies.length ? (
        <FacetRow
          label="Companies"
          values={facets.companies.slice(0, 10)}
          selected={query.companies}
          onToggle={(value) => dispatch(companyToggled(value))}
        />
      ) : null}
    </div>
  );
}

function FacetRow({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: { value: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
        {label}
      </span>
      {values.map((facet) => {
        const active = selected.includes(facet.value);
        return (
          <button
            key={facet.value}
            type="button"
            onClick={() => onToggle(facet.value)}
            aria-pressed={active}
            className="rounded-md"
          >
            <Badge variant={active ? 'accent' : 'neutral'}>
              {facet.value}
              <span className="opacity-60">{facet.count}</span>
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
