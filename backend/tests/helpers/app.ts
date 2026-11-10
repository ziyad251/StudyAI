import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { buildConfig, parseEnv, type AppConfig } from '../../src/config/env.js';
import { subjects, teacherSubjects, users, type UserRole } from '../../src/db/schema.js';
import type { AiProvider } from '../../src/services/ai/ai.provider.js';
import { hashPassword } from '../../src/utils/password.js';
import { createTestDatabase } from './db.js';
import { MockAiProvider } from './mock-ai.js';

export const TEST_PASSWORD = 'Str0ng!Passw0rd';
export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret-that-is-definitely-long-enough-123',
  FRONTEND_URL: 'http://localhost:5173',
};

export function testConfig(overrides: (config: AppConfig) => void = () => {}): AppConfig {
  const config = buildConfig(parseEnv(TEST_ENV as NodeJS.ProcessEnv));
  config.rateLimits = {
    global: { windowMs: 60_000, limit: 10_000 },
    auth: { windowMs: 60_000, limit: 10_000 },
    ai: { windowMs: 60_000, limit: 10_000 },
    write: { windowMs: 60_000, limit: 10_000 },
  };
  overrides(config);
  return config;
}

export interface TestContext {
  app: Express;
  db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
  ai: MockAiProvider;
  config: AppConfig;
  close: () => Promise<void>;
}

export async function createTestContext(
  options: { ai?: AiProvider | null; configure?: (config: AppConfig) => void } = {},
): Promise<TestContext> {
  const database = await createTestDatabase();
  const ai = new MockAiProvider();
  const config = testConfig(options.configure);
  const app = createApp({
    config,
    db: database.db,
    aiProvider: options.ai === undefined ? ai : options.ai,
  });
  return { app, db: database.db, ai, config, close: database.close };
}

export interface Client {
  agent: ReturnType<typeof request.agent>;
  id: string;
  email: string;
  role: UserRole;
  get: (url: string) => request.Test;
  post: (url: string, body?: object) => request.Test;
  patch: (url: string, body?: object) => request.Test;
  put: (url: string, body?: object) => request.Test;
  delete: (url: string) => request.Test;
}

function wrap(
  agent: ReturnType<typeof request.agent>,
  meta: Pick<Client, 'id' | 'email' | 'role'>,
): Client {
  const csrf = { 'X-Requested-With': 'XMLHttpRequest' };
  return {
    agent,
    ...meta,
    get: (url) => agent.get(url),
    post: (url, body) =>
      agent
        .post(url)
        .set(csrf)
        .send(body ?? {}),
    patch: (url, body) =>
      agent
        .patch(url)
        .set(csrf)
        .send(body ?? {}),
    put: (url, body) =>
      agent
        .put(url)
        .set(csrf)
        .send(body ?? {}),
    delete: (url) => agent.delete(url).set(csrf),
  };
}

let counter = 0;
export function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}${counter}.${Date.now()}@college.edu`;
}

export function registrationPayload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Test Student',
    email: uniqueEmail('student'),
    password: TEST_PASSWORD,
    department: 'Computer Science',
    academicYear: 2,
    ...overrides,
  };
}

export async function registerStudent(
  ctx: TestContext,
  overrides: Record<string, unknown> = {},
): Promise<Client> {
  const agent = request.agent(ctx.app);
  const payload = registrationPayload(overrides);
  const res = await agent
    .post('/api/auth/register')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(payload);
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const [row] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, payload.email as string));
  return wrap(agent, { id: row!.id, email: payload.email as string, role: 'STUDENT' });
}

export async function createUserAndLogin(
  ctx: TestContext,
  role: UserRole,
  options: { subjectCodes?: string[]; fullName?: string } = {},
): Promise<Client> {
  const email = uniqueEmail(role.toLowerCase());
  const [row] = await ctx.db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: options.fullName ?? `Test ${role.toLowerCase()}`,
      role,
      department: 'Computer Science',
      academicYear: role === 'STUDENT' ? 1 : null,
    })
    .returning({ id: users.id });

  if (options.subjectCodes?.length) {
    const subjectRows = await ctx.db.select().from(subjects);
    const ids = subjectRows.filter((s) => options.subjectCodes!.includes(s.code)).map((s) => s.id);
    await ctx.db
      .insert(teacherSubjects)
      .values(ids.map((subjectId) => ({ teacherId: row!.id, subjectId })));
  }

  const agent = request.agent(ctx.app);
  const res = await agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: TEST_PASSWORD });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return wrap(agent, { id: row!.id, email, role });
}

export async function subjectId(ctx: TestContext, code: string): Promise<string> {
  const [row] = await ctx.db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.code, code));
  return row!.id;
}

export function questionPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'How does normalization work in DBMS?',
    description: 'Can someone explain the difference between 2NF and 3NF with an example?',
    ...overrides,
  };
}

export async function askQuestion(
  client: Client,
  ctx: TestContext,
  overrides: Record<string, unknown> = {},
) {
  const res = await client.post(
    '/api/questions',
    questionPayload({ subjectId: await subjectId(ctx, 'CS202'), ...overrides }),
  );
  if (res.status !== 201)
    throw new Error(`askQuestion failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; title: string; status: string };
}

export function sessionCookie(res: request.Response, name = 'studyai_session') {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${name}=`));
}
