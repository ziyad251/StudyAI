import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  TEST_PASSWORD,
  askQuestion,
  createTestContext,
  registerStudent,
  registrationPayload,
  type TestContext,
} from '../helpers/app.js';

describe('rate limiting', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext({
      configure: (c) => {
        c.rateLimits.auth = { windowMs: 60_000, limit: 3 };
        c.rateLimits.ai = { windowMs: 60_000, limit: 2 };
      },
    });
  });
  afterAll(() => ctx.close());

  it('throttles repeated login attempts with 429 and standard headers', async () => {
    const attempt = () =>
      request(ctx.app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'x@college.edu', password: 'Wrong!Pass123' });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['ratelimit-policy'] ?? blocked.headers['ratelimit']).toBeDefined();
  });
});

describe('AI rate limiting', () => {
  let aiCtx: TestContext;
  beforeAll(async () => {
    aiCtx = await createTestContext({
      configure: (c) => (c.rateLimits.ai = { windowMs: 60_000, limit: 2 }),
    });
  });
  afterAll(() => aiCtx.close());

  it('limits AI usage per user, independently for each user', async () => {
    const a = await registerStudent(aiCtx);
    const b = await registerStudent(aiCtx);
    const call = (client: typeof a) =>
      client.post('/api/ai/check-personal-information', { text: 'Explain joins' });
    expect((await call(a)).status).toBe(200);
    expect((await call(a)).status).toBe(200);
    expect((await call(a)).status).toBe(429);
    expect((await call(b)).status).toBe(200);
  });
});

describe('HTTP security and error handling', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('sets secure headers and hides the framework', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('allows CORS only for configured origins, with credentials', async () => {
    const allowed = await request(ctx.app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await request(ctx.app).get('/api/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send(registrationPayload());
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/CSRF/);

    const student = await registerStudent(ctx);
    const noHeader = await student.agent.post('/api/questions').send({ title: 'x' });
    expect(noHeader.status).toBe(403);
  });

  it('returns consistent JSON errors', async () => {
    const notFound = await request(ctx.app).get('/api/does-not-exist');
    expect(notFound.status).toBe(404);
    expect(notFound.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/does-not-exist not found' },
    });

    const badJson = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');

    const tooLarge = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'a@b.co', password: 'x'.repeat(200_000) });
    expect(tooLarge.status).toBe(413);
  });

  it('never leaks internal errors or stack traces', async () => {
    const student = await registerStudent(ctx);
    const res = await student.get('/api/questions/not-a-uuid');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|drizzle|postgres|select/i);
  });

  it('treats SQL-like input as plain data', async () => {
    const student = await registerStudent(ctx);
    const q = await askQuestion(student, ctx, {
      title: "Robert'); DROP TABLE questions;-- explain",
      description: "SELECT * FROM users WHERE '1'='1'; is this injection?",
    });
    const res = await student.get(`/api/questions/${q.id}`);
    expect(res.body.title).toBe("Robert'); DROP TABLE questions;-- explain");
    expect((await student.get('/api/questions')).status).toBe(200);
  });

  it('accepts login with a password exactly at the bcrypt 72-byte limit only via policy', async () => {
    const long = `Aa1!${'x'.repeat(69)}`;
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send(registrationPayload({ password: long }));
    expect(res.status).toBe(400);
    const ok = await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send(registrationPayload({ password: TEST_PASSWORD }));
    expect(ok.status).toBe(201);
  });
});
