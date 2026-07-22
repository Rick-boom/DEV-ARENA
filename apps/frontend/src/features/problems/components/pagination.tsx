import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

/**
 * Pagination. States the range in words ("26–50 of 412") rather than
 * page numbers alone, because "page 2" tells you nothing about where you
 * are in a result set.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3"
    >
      <p className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
        {from}–{to} of {total.toLocaleString()}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </Button>
        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]" aria-current="page">
          {page} / {lastPage}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
