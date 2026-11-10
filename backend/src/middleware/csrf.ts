import type { RequestHandler } from 'express';
import { ForbiddenError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (req.get('x-requested-with') !== 'XMLHttpRequest') {
    throw new ForbiddenError('Missing or invalid CSRF header');
  }
  next();
};
