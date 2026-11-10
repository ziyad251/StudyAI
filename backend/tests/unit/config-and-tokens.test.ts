import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { TokenService } from '../../src/utils/jwt.js';
import { escapeLike, normaliseWhitespace, truncate } from '../../src/utils/text.js';
import { TEST_ENV } from '../helpers/app.js';

describe('environment validation', () => {
  it('loads a valid configuration', () => {
    const config = loadConfig({
      ...TEST_ENV,
      FRONTEND_URL: 'http://a.test, https://b.test',
    } as NodeJS.ProcessEnv);
    expect(config.cors.origins).toEqual(['http://a.test', 'https://b.test']);
    expect(config.port).toBe(4000);
    expect(config.ai.apiKey).toBeUndefined();
  });

  it('fails fast with a readable message when required variables are missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*FRONTEND_URL/,
    );
  });

  it('parses TRUST_PROXY as a hop count', () => {
    const parse = (v?: string) =>
      loadConfig({ ...TEST_ENV, TRUST_PROXY: v } as NodeJS.ProcessEnv).trustProxy;
    expect([parse(undefined), parse('false'), parse('true'), parse('2')]).toEqual([0, 0, 1, 2]);
    expect(() => parse('lots')).toThrow(/TRUST_PROXY/);
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadConfig({ ...TEST_ENV, JWT_SECRET: 'short' } as NodeJS.ProcessEnv)).toThrow(
      /at least 32/,
    );
  });

  it('rejects the placeholder secret in production', () => {
    expect(() =>
      loadConfig({
        ...TEST_ENV,
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-to-a-long-random-secret-of-at-least-32-chars',
      } as NodeJS.ProcessEnv),
    ).toThrow(/placeholder/);
  });

  it('uses secure __Host- cookies in production and Lax cookies in development', () => {
    const prod = loadConfig({ ...TEST_ENV, NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(prod.cookie).toEqual({ name: '__Host-studyai_session', secure: true, sameSite: 'lax' });
    const dev = loadConfig({ ...TEST_ENV, NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    expect(dev.cookie.secure).toBe(false);
  });
});

describe('TokenService', () => {
  const tokens = new TokenService('x'.repeat(40), 60);

  it('round-trips claims', () => {
    const token = tokens.sign({ sub: 'user-1', ver: 3, role: 'TEACHER' });
    expect(tokens.verify(token)).toEqual({ sub: 'user-1', ver: 3, role: 'TEACHER' });
  });

  it('rejects tokens signed with another secret', () => {
    const other = new TokenService('y'.repeat(40), 60);
    expect(tokens.verify(other.sign({ sub: 'u', ver: 0, role: 'ADMIN' }))).toBeNull();
  });
});

describe('text utilities', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
  it('truncates with an ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });
  it('normalises whitespace', () => {
    expect(normaliseWhitespace('  a   b\n\n\n\nc  ')).toBe('a b\n\nc');
  });
});
