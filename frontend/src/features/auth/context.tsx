import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type RegisterInput } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { recordSessionEnd } from '@/lib/session';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          recordSessionEnd(error);
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const setUser = useCallback(
    (user: User) => queryClient.setQueryData(queryKeys.me, user),
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await api.auth.login({ email, password });
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, user);
      return user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const user = await api.auth.register(input);
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, user);
      return user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, null);
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: data ?? null, isLoading: isPending, login, register, logout, setUser }),
    [data, isPending, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function homePathFor(role: User['role']): string {
  return role === 'ADMIN' ? '/admin' : role === 'TEACHER' ? '/teacher' : '/dashboard';
}
