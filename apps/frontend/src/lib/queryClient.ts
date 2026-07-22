import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient instance with conservative defaults:
 * no refetch-on-focus spam, one retry, 30s staleness — good baselines
 * for an app that will layer real-time sockets on top of REST.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});
