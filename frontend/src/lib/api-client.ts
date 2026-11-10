import axios, { type AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '/api';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as FieldIssue[]).map((d) => [d.path, d.message]));
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string; details?: unknown } }>) => {
    if (error.response) {
      const body = error.response.data?.error;
      return Promise.reject(
        new ApiError(
          body?.message ?? 'Something went wrong. Please try again.',
          error.response.status,
          body?.code ?? 'UNKNOWN',
          body?.details,
        ),
      );
    }
    const message =
      error.code === 'ECONNABORTED'
        ? 'The request timed out. Please try again.'
        : 'Unable to reach the server. Check your connection.';
    return Promise.reject(new ApiError(message, 0, 'NETWORK_ERROR'));
  },
);

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
