import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export function useSubjects(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.subjects(includeInactive),
    queryFn: () => api.subjects.list({ includeInactive: includeInactive || undefined }),
    staleTime: 10 * 60 * 1000,
  });
}

export function useAiStatus() {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: api.ai.status,
    staleTime: 10 * 60 * 1000,
  });
}
