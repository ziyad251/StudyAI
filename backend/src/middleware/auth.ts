import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import type { UserRole } from '../db/schema.js';
import { userRepository } from '../repositories/user.repository.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import type { TokenService } from '../utils/jwt.js';
import { clearSessionCookie, setSessionCookie } from '../utils/session-cookie.js';

const SESSION_REJECTIONS = {
  expired: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' },
  revoked: { code: 'SESSION_REVOKED', message: 'You have been signed out. Please sign in again.' },
  invalid: { code: 'UNAUTHORIZED', message: 'Your session is invalid. Please sign in again.' },
} as const;

function extractToken(
  req: Request,
  cookieName: string,
): { token: string; source: 'cookie' | 'bearer' } | undefined {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[cookieName];
  if (cookieToken) return { token: cookieToken, source: 'cookie' };
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return { token: header.slice('Bearer '.length).trim(), source: 'bearer' };
  }
  return undefined;
}

export interface AuthMiddleware {
  requireAuth: RequestHandler;
  optionalAuth: RequestHandler;
}

export function createAuthMiddleware(deps: {
  db: Database;
  config: AppConfig;
  tokens: TokenService;
}): AuthMiddleware {
  async function resolveUser(req: Request, res: Response) {
    const extracted = extractToken(req, deps.config.cookie.name);
    if (!extracted) return { status: 'missing' as const };

    const verified = deps.tokens.inspect(extracted.token);
    if (verified.status !== 'valid') return { status: verified.status };
    const { claims } = verified;

    const user = await userRepository.findAuthById(deps.db, claims.sub);
    if (!user) return { status: 'invalid' as const };
    // Logged out elsewhere, password changed, or account suspended.
    if (!user.isActive || user.tokenVersion !== claims.ver) return { status: 'revoked' as const };

    // Only cookie sessions are renewed: bearer clients manage their own tokens.
    if (extracted.source === 'cookie' && deps.tokens.shouldRenew(verified.expiresAt)) {
      const renewed = deps.tokens.sign({ sub: user.id, ver: user.tokenVersion, role: user.role });
      setSessionCookie(res, deps.config, renewed);
    }

    return {
      status: 'ok' as const,
      user: { id: user.id, role: user.role, fullName: user.fullName },
    };
  }

  return {
    async requireAuth(req: Request, res: Response, next: NextFunction) {
      const result = await resolveUser(req, res);
      if (result.status === 'missing') throw new UnauthorizedError();
      if (result.status !== 'ok') {
        // Drop the dead cookie so the browser stops replaying it on every request.
        clearSessionCookie(res, deps.config);
        const { code, message } = SESSION_REJECTIONS[result.status];
        throw new UnauthorizedError(message, code);
      }
      req.user = result.user;
      next();
    },
    async optionalAuth(req: Request, res: Response, next: NextFunction) {
      const result = await resolveUser(req, res);
      if (result.status === 'ok') req.user = result.user;
      else if (result.status !== 'missing') clearSessionCookie(res, deps.config);
      next();
    },
  };
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) throw new ForbiddenError();
    next();
  };
}

export function currentUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
