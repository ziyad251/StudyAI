import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';
import { queryKeys } from './query-keys';
import { recordSessionEnd } from './session';

export function createQueryClient() {
  // Any request that comes back 401 means the session cookie is gone or dead. Signing the user out
  // locally lets the route guards send them to /login instead of leaving them on a broken page.
  const handleUnauthorized = (error: unknown) => {
    if (!(error instanceof ApiError) || error.status !== 401) return;
    if (client.getQueryData(queryKeys.me) === null) return;
    recordSessionEnd(error);
    client.setQueryData(queryKeys.me, null);
  };

  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
    queryCache: new QueryCache({ onError: handleUnauthorized }),
    mutationCache: new MutationCache({ onError: handleUnauthorized }),
  });
  return client;
}
