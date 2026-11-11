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

/** Returns the reason recorded by {@link recordSessionEnd} and clears it. */
export function consumeSessionEndReason(): SessionEndReason | null {
  const reason = pendingReason;
  pendingReason = null;
  return reason;
}
