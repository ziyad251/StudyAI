import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/env.js';

export function sessionCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
    maxAge: config.jwt.expiresInSeconds * 1000,
  };
}

export function setSessionCookie(res: Response, config: AppConfig, token: string) {
  res.cookie(config.cookie.name, token, sessionCookieOptions(config));
}

export function clearSessionCookie(res: Response, config: AppConfig) {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(config);
  res.clearCookie(config.cookie.name, options);
}
