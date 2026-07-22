import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeTestStore, screen, waitFor } from '@/test/render.js';
import { ProblemRow } from '../components/problem-row.js';
import { ProblemList } from '../components/problem-list.js';
import { Pagination } from '../components/pagination.js';
import { FilterBar } from '../components/filter-bar.js';
import { Difficulty, type ProblemSummary } from '@/types/problem.types.js';
import type * as ProblemApi from '@/store/api/problem-api.js';

// Facets come from the network; the explorer must work without them.
vi.mock('@/store/api/problem-api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ProblemApi>();
  return {
    ...actual,
    useGetFacetsQuery: () => ({ data: { tags: [{ value: 'arrays', count: 42 }], companies: [] } }),
    useToggleBookmarkMutation: () => [vi.fn(), { isLoading: false }],
  };
});

function problem(overrides: Partial<ProblemSummary> = {}): ProblemSummary {
  return {
    id: 'p1',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: Difficulty.EASY,
    tags: ['arrays', 'hashmap'],
    companies: ['Google'],
    acceptedRate: 0.482,
    totalSubmissions: 12000,
    solved: false,
    bookmarked: false,
    ...overrides,
  };
}

describe('ProblemRow', () => {
  it('links to the workspace and shows difficulty + acceptance', () => {
    renderWithProviders(<ProblemRow problem={problem()} />);

    expect(screen.getByRole('link', { name: 'Two Sum' })).toHaveAttribute(
      'href',
      '/problems/two-sum',
    );
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('48.2%')).toBeInTheDocument();
  });

  it('announces solved state rather than relying on colour', () => {
    renderWithProviders(<ProblemRow problem={problem({ solved: true })} />);
    expect(screen.getByText('Solved')).toBeInTheDocument();
  });

  it('labels the bookmark control with the problem it affects', () => {
    renderWithProviders(<ProblemRow problem={problem()} />);
    expect(screen.getByRole('button', { name: /bookmark two sum/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('ProblemList', () => {
  it('offers a way out of an over-filtered empty state', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderWithProviders(<ProblemList problems={[]} isLoading={false} onClearFilters={onClear} />);

    expect(screen.getByText(/no problems match these filters/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('marks itself busy while loading', () => {
    const { container } = renderWithProviders(
      <ProblemList problems={[]} isLoading onClearFilters={vi.fn()} />,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('states the visible range in words', () => {
    renderWithProviders(<Pagination page={2} pageSize={25} total={412} onPageChange={vi.fn()} />);
    expect(screen.getByText('26–50 of 412')).toBeInTheDocument();
  });

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = renderWithProviders(
      <Pagination page={1} pageSize={25} total={60} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    rerender(<Pagination page={3} pageSize={25} total={60} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('advances the page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderWithProviders(
      <Pagination page={1} pageSize={25} total={200} onPageChange={onPageChange} />,
    );
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe('FilterBar', () => {
  it('debounces search rather than dispatching every keystroke', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    renderWithProviders(<FilterBar />, { store });

    await user.type(screen.getByLabelText(/search problems/i), 'graph');
    // Not yet — the debounce is still pending.
    expect(store.getState().problem.query.search).toBe('');

    await waitFor(() => expect(store.getState().problem.query.search).toBe('graph'), {
      timeout: 1500,
    });
  });

  it('toggles a difficulty filter', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    renderWithProviders(<FilterBar />, { store });

    await user.click(screen.getByRole('button', { name: 'Medium' }));
    expect(store.getState().problem.query.difficulties).toEqual([Difficulty.MEDIUM]);
  });

  it('shows a clear control only once filters are active', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    renderWithProviders(<FilterBar />, { store });

    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hard' }));
    expect(await screen.findByRole('button', { name: /clear \(1\)/i })).toBeInTheDocument();
  });
});
