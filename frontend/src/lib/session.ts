import { ApiError } from './api-client';

export type SessionEndReason = 'expired' | 'revoked';

const REASON_BY_CODE: Record<string, SessionEndReason> = {
  SESSION_EXPIRED: 'expired',
  SESSION_REVOKED: 'revoked',
};

let pendingReason: SessionEndReason | null = null;

/** True for a 401 that means "your session is gone", as opposed to e.g. bad login credentials. */
export function isSessionError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401 && error.code in REASON_BY_CODE;
}

/** Remembers why the session ended so the login screen can explain it once. */
export function recordSessionEnd(error: unknown) {
  if (isSessionError(error)) pendingReason = REASON_BY_CODE[error.code]!;
}

/** The reason recorded by {@link recordSessionEnd}, if any. Safe to call during render. */
export function peekSessionEndReason(): SessionEndReason | null {
  return pendingReason;
}

export function clearSessionEndReason() {
  pendingReason = null;
}

export const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  expired: 'Your session expired. Please sign in again to continue.',
  revoked:
    'You were signed out because your password changed or you logged out on another device. Please sign in again.',
};
