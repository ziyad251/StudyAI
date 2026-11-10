import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { RateLimitConfig } from '../config/env.js';

export function createRateLimiter(
  config: RateLimitConfig,
  options: { message?: string; keyBy?: 'ip' | 'user-or-ip'; skipSafeMethods?: boolean } = {},
): RequestHandler {
  const { message = 'Too many requests, please try again later.', keyBy = 'user-or-ip' } = options;

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: options.skipSafeMethods
      ? (req) => req.method === 'GET' || req.method === 'HEAD'
      : undefined,
    keyGenerator: (req) => {
      if (keyBy === 'user-or-ip' && req.user) return `user:${req.user.id}`;
      return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
    },
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}
