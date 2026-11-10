import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import type { UserRole } from '../db/schema.js';
import { userRepository } from '../repositories/user.repository.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import type { TokenService } from '../utils/jwt.js';

function extractToken(req: Request, cookieName: string): string | undefined {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[cookieName];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
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
  async function resolveUser(req: Request) {
    const token = extractToken(req, deps.config.cookie.name);
    if (!token) return { status: 'missing' as const };

    const claims = deps.tokens.verify(token);
    if (!claims) return { status: 'invalid' as const };

    const user = await userRepository.findAuthById(deps.db, claims.sub);
    if (!user || !user.isActive || user.tokenVersion !== claims.ver) {
      return { status: 'invalid' as const };
    }
    return {
      status: 'ok' as const,
      user: { id: user.id, role: user.role, fullName: user.fullName },
    };
  }

  return {
    async requireAuth(req: Request, _res: Response, next: NextFunction) {
      const result = await resolveUser(req);
      if (result.status === 'missing') throw new UnauthorizedError();
      if (result.status === 'invalid')
        throw new UnauthorizedError('Your session is invalid or has expired');
      req.user = result.user;
      next();
    },
    async optionalAuth(req: Request, _res: Response, next: NextFunction) {
      const result = await resolveUser(req);
      if (result.status === 'ok') req.user = result.user;
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
