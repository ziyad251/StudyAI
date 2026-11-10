import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';
import { queryKeys } from './query-keys';

export function createQueryClient() {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401)
          client.setQueryData(queryKeys.me, null);
      },
    }),
  });
  return client;
}
