import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Skeleton } from '@/components/ui/skeleton.js';
import { Button } from '@/components/ui/button.js';
import { ProblemRow } from './problem-row.js';
import type { ProblemSummary } from '@/types/problem.types.js';

/**
 * Virtualized results list.
 *
 * Only the rows in view are mounted. At a page size of 25 this is
 * arguably overkill, but the same component serves "show 200 per page"
 * and bookmark views, and virtualization keeps scrolling smooth in
 * every case rather than only the small one.
 */
export function ProblemList({
  problems,
  isLoading,
  onClearFilters,
}: {
  problems: ProblemSummary[];
  isLoading: boolean;
  onClearFilters: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: problems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px" aria-busy="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-[68px] w-full rounded-none" />
        ))}
      </div>
    );
  }

  if (!problems.length) {
    return (
      <div className="grid place-items-center px-6 py-16 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <p className="text-[15px] font-medium">No problems match these filters</p>
          <p className="text-[13px] text-[var(--color-fg-muted)]">
            Try removing a filter or searching for something broader.
          </p>
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="max-h-[62vh] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const problem = problems[item.index];
          if (!problem) return null;
          return (
            <div
              key={problem.id}
              ref={virtualizer.measureElement}
              data-index={item.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${item.start}px)`,
              }}
            >
              <ProblemRow problem={problem} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
