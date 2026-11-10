import { expect } from 'vitest';

export const FORBIDDEN_KEYS = [
  'authorId',
  'author_id',
  'userId',
  'user_id',
  'reporterId',
  'email',
  'passwordHash',
  'password_hash',
  'password',
  'tokenVersion',
  'rollNumber',
  'fullName',
];

function walk(
  value: unknown,
  path: string,
  visit: (key: string, value: unknown, path: string) => void,
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, visit));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      visit(key, child, `${path}.${key}`);
      walk(child, `${path}.${key}`, visit);
    }
  }
}

export function expectNoPrivateData(
  body: unknown,
  options: { secrets?: string[]; allowKeys?: string[] } = {},
) {
  const allowed = new Set(options.allowKeys ?? []);
  walk(body, '$', (key, _value, path) => {
    if (FORBIDDEN_KEYS.includes(key) && !allowed.has(key)) {
      expect.fail(`Private field "${key}" exposed at ${path}`);
    }
  });

  const serialised = JSON.stringify(body);
  for (const secret of options.secrets ?? []) {
    if (secret && serialised.includes(secret)) {
      expect.fail(`Private value "${secret}" found in response`);
    }
  }
  expect(serialised).not.toMatch(/\$2[aby]\$\d{2}\$/);
}
