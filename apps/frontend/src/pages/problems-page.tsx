import { Card } from '@/components/ui/card.js';
import { Alert } from '@/components/ui/alert.js';
import { FilterBar } from '@/features/problems/components/filter-bar.js';
import { ProblemList } from '@/features/problems/components/problem-list.js';
import { Pagination } from '@/features/problems/components/pagination.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectProblemQuery } from '@/store/selectors.js';
import { filtersCleared, pageChanged } from '@/store/slices/problem-slice.js';
import { useListProblemsQuery } from '@/store/api/problem-api.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { NotificationVariant } from '@/types/ui.types.js';

/**
 * Problem explorer. The query lives in Redux so filters, list and
 * pagination all read one source; RTK Query caches per query object, so
 * paging back to a previous page is instant.
 */
export function ProblemsPage() {
  useDocumentTitle('Problems');
  const dispatch = useAppDispatch();
  const query = useAppSelector(selectProblemQuery);
  const { data, isFetching, isError, refetch } = useListProblemsQuery(query);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
        <p className="text-[13px] text-[var(--color-fg-muted)]">
          {data ? `${data.total.toLocaleString()} problems` : 'Loading the catalogue…'}
        </p>
      </header>

      <FilterBar />

      {isError ? (
        <Alert variant={NotificationVariant.ERROR} title="Couldn't load problems">
          <button
            type="button"
            onClick={() => void refetch()}
            className="underline underline-offset-4"
          >
            Try again
          </button>
        </Alert>
      ) : (
        <Card className="overflow-hidden p-0">
          <ProblemList
            problems={data?.items ?? []}
            isLoading={isFetching && !data}
            onClearFilters={() => dispatch(filtersCleared())}
          />
          {data && data.total > 0 ? (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(page) => dispatch(pageChanged(page))}
            />
          ) : null}
        </Card>
      )}
    </div>
  );
}
