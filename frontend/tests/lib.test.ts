import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { ApiError, apiClient } from '@/lib/api-client';
import { registerSchema } from '@/features/auth/schemas';
import { initials, pluralize, timeAgo } from '@/lib/format';
import { createQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import {
  clearSessionEndReason,
  isSessionError,
  peekSessionEndReason,
  recordSessionEnd,
} from '@/lib/session';
import { makeUser } from './utils';

describe('api client', () => {
  it('sends credentials and the CSRF header on every request', () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(apiClient.defaults.baseURL).toBe('/api');
  });

  it('normalises API error responses into ApiError with field errors', async () => {
    const handler = (
      apiClient.interceptors.response as unknown as {
        handlers: { rejected: (e: unknown) => Promise<never> }[];
      }
    ).handlers[0]!.rejected;
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ path: 'email', message: 'Bad email' }],
        },
      },
    });
    const result = await handler(error).catch((e: unknown) => e);
    expect(result).toBeInstanceOf(ApiError);
    expect(result).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });
    expect((result as ApiError).fieldErrors).toEqual({ email: 'Bad email' });
  });

  it('reports network failures without leaking internals', async () => {
    const handler = (
      apiClient.interceptors.response as unknown as {
        handlers: { rejected: (e: unknown) => Promise<never> }[];
      }
    ).handlers[0]!.rejected;
    const result = await handler(new AxiosError('Network Error', 'ERR_NETWORK')).catch(
      (e: unknown) => e,
    );
    expect(result).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});

describe('registration schema', () => {
  const valid = {
    fullName: 'Priya Sharma',
    email: 'priya@college.edu',
    department: 'CS',
    academicYear: '2',
    rollNumber: '',
    password: 'Str0ng!Passw0rd',
    confirmPassword: 'Str0ng!Passw0rd',
  };

  it('accepts valid input', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a password that contains the email name', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'Priya#Secure123',
      confirmPassword: 'Priya#Secure123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects roll numbers with unsafe characters', () => {
    expect(registerSchema.safeParse({ ...valid, rollNumber: '<script>' }).success).toBe(false);
  });
});

describe('formatting helpers', () => {
  it('formats relative time', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(timeAgo('2026-11-10T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-11-10T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-11-09T12:00:00Z', now)).toBe('yesterday');
  });
  it('pluralizes and builds initials', () => {
    expect(pluralize(1, 'answer')).toBe('1 answer');
    expect(pluralize(3, 'answer')).toBe('3 answers');
    expect(initials('Anita  Rao Kumar')).toBe('AR');
  });
});

describe('session expiry handling', () => {
  it('signs the user out locally and remembers why when a query hits a dead session', async () => {
    const client = createQueryClient();
    client.setQueryData(queryKeys.me, makeUser());

    await client
      .fetchQuery({
        queryKey: ['questions'],
        queryFn: () =>
          Promise.reject(new ApiError('Your session has expired', 401, 'SESSION_EXPIRED')),
      })
      .catch(() => {});

    expect(client.getQueryData(queryKeys.me)).toBeNull();
    expect(peekSessionEndReason()).toBe('expired');
    clearSessionEndReason();
    expect(peekSessionEndReason()).toBeNull();
  });

  it('does not record a reason for ordinary 401s or other errors', () => {
    expect(isSessionError(new ApiError('Invalid email or password', 401, 'UNAUTHORIZED'))).toBe(
      false,
    );
    expect(isSessionError(new ApiError('Forbidden', 403, 'SESSION_REVOKED'))).toBe(false);
    recordSessionEnd(new ApiError('Invalid email or password', 401, 'UNAUTHORIZED'));
    expect(peekSessionEndReason()).toBeNull();
  });
});
