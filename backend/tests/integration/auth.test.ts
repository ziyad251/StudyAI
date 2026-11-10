import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { users } from '../../src/db/schema.js';
import {
  TEST_ENV,
  TEST_PASSWORD,
  createTestContext,
  registerStudent,
  registrationPayload,
  sessionCookie,
  type TestContext,
} from '../helpers/app.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('authentication', () => {
  let ctx: TestContext;
  const post = (url: string, body: object) => request(ctx.app).post(url).set(CSRF).send(body);

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  describe('registration', () => {
    it('registers a student, sets an HttpOnly session cookie and returns a safe profile', async () => {
      const payload = registrationPayload({
        email: 'New.Student@College.edu',
        rollNumber: 'cs-21-001',
      });
      const res = await post('/api/auth/register', payload);

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        email: 'new.student@college.edu',
        role: 'STUDENT',
        rollNumber: 'CS-21-001',
        academicYear: 2,
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
      const cookie = sessionCookie(res);
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const [row] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, 'new.student@college.edu'));
      expect(row!.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(row!.passwordHash).not.toContain(TEST_PASSWORD);
    });

    it('prevents duplicate emails (case-insensitive)', async () => {
      const email = 'dup@college.edu';
      expect((await post('/api/auth/register', registrationPayload({ email }))).status).toBe(201);
      const res = await post(
        '/api/auth/register',
        registrationPayload({ email: 'DUP@college.edu' }),
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('prevents duplicate roll numbers', async () => {
      await post('/api/auth/register', registrationPayload({ rollNumber: 'ROLL-777' }));
      const res = await post('/api/auth/register', registrationPayload({ rollNumber: 'roll-777' }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROLL_NUMBER_TAKEN');
    });

    it.each([
      ['too short', 'Ab1!'],
      ['no uppercase', 'lowercase1!pass'],
      ['no lowercase', 'UPPERCASE1!PASS'],
      ['no digit', 'NoDigitsHere!!'],
      ['no symbol', 'NoSymbols123abc'],
    ])('rejects weak passwords (%s)', async (_label, password) => {
      const res = await post('/api/auth/register', registrationPayload({ password }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: { path: string }) => d.path === 'password')).toBe(
        true,
      );
    });

    it('rejects a password containing the email name', async () => {
      const res = await post(
        '/api/auth/register',
        registrationPayload({ email: 'priyanka@college.edu', password: 'Priyanka#2026!' }),
      );
      expect(res.status).toBe(400);
    });

    it('validates required fields and formats', async () => {
      const res = await post('/api/auth/register', {
        email: 'not-an-email',
        password: TEST_PASSWORD,
      });
      expect(res.status).toBe(400);
      const paths = res.body.error.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(
        expect.arrayContaining(['fullName', 'email', 'department', 'academicYear']),
      );
    });

    it('rejects academic years outside 1–6', async () => {
      const res = await post('/api/auth/register', registrationPayload({ academicYear: 9 }));
      expect(res.status).toBe(400);
    });

    it('8. users cannot assign themselves a role through registration', async () => {
      for (const role of ['ADMIN', 'TEACHER']) {
        const payload = registrationPayload({ role });
        const res = await post('/api/auth/register', payload);
        expect(res.status).toBe(400);
        const [row] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.email, payload.email as string));
        expect(row).toBeUndefined();
      }
      for (const extra of [{ isActive: false }, { tokenVersion: 5 }, { passwordHash: 'x' }]) {
        expect((await post('/api/auth/register', registrationPayload(extra))).status).toBe(400);
      }
    });

    describe('with ALLOWED_EMAIL_DOMAINS configured', () => {
      let restricted: TestContext;
      beforeAll(async () => {
        restricted = await createTestContext({
          configure: (c) => (c.allowedEmailDomains = ['college.edu']),
        });
      });
      afterAll(() => restricted.close());

      it('restricts registration to allowed college domains (including subdomains)', async () => {
        const bad = await request(restricted.app)
          .post('/api/auth/register')
          .set(CSRF)
          .send(registrationPayload({ email: 'someone@gmail.com' }));
        expect(bad.status).toBe(400);
        const lookalike = await request(restricted.app)
          .post('/api/auth/register')
          .set(CSRF)
          .send(registrationPayload({ email: 'someone@evilcollege.edu' }));
        expect(lookalike.status).toBe(400);
        const good = await request(restricted.app)
          .post('/api/auth/register')
          .set(CSRF)
          .send(registrationPayload({ email: 'someone@cs.college.edu' }));
        expect(good.status).toBe(201);
      });
    });
  });

  describe('login and sessions', () => {
    it('logs in with correct credentials', async () => {
      const student = await registerStudent(ctx);
      const res = await post('/api/auth/login', {
        email: student.email.toUpperCase(),
        password: TEST_PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(student.email);
      expect(sessionCookie(res)).toBeDefined();
    });

    it('returns the same generic error for a wrong password and an unknown email', async () => {
      const student = await registerStudent(ctx);
      const wrong = await post('/api/auth/login', {
        email: student.email,
        password: 'Wrong!Passw0rd',
      });
      const unknown = await post('/api/auth/login', {
        email: 'nobody@college.edu',
        password: 'Wrong!Passw0rd',
      });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
    });

    it('GET /auth/me returns the current user', async () => {
      const student = await registerStudent(ctx);
      const res = await student.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(student.email);
    });

    it('6. unauthenticated users cannot access protected endpoints', async () => {
      const endpoints = [
        ['get', '/api/auth/me'],
        ['get', '/api/questions'],
        ['post', '/api/questions'],
        ['get', '/api/notifications'],
        ['post', '/api/ai/ask'],
        ['post', '/api/reports'],
        ['get', '/api/teacher/questions'],
        ['get', '/api/admin/statistics'],
      ] as const;
      for (const [method, url] of endpoints) {
        const res = await request(ctx.app)[method](url).set(CSRF).send({});
        expect(res.status, `${method.toUpperCase()} ${url}`).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('7. invalid JWT tokens are rejected', async () => {
      const student = await registerStudent(ctx);
      const valid = jwt.sign({ ver: 0, role: 'STUDENT' }, TEST_ENV.JWT_SECRET, {
        subject: student.id,
        issuer: 'studyai-api',
        audience: 'studyai-web',
        expiresIn: 60,
      });
      const [header, payload] = valid.split('.');
      const forged = jwt.sign(
        { ver: 0, role: 'ADMIN' },
        'a-completely-different-secret-value-xyz',
        {
          subject: student.id,
          issuer: 'studyai-api',
          audience: 'studyai-web',
        },
      );
      const expired = jwt.sign(
        { ver: 0, role: 'STUDENT', exp: Math.floor(Date.now() / 1000) - 10 },
        TEST_ENV.JWT_SECRET,
        {
          subject: student.id,
          issuer: 'studyai-api',
          audience: 'studyai-web',
        },
      );
      const algNone = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.`;
      const wrongAudience = jwt.sign({ ver: 0, role: 'STUDENT' }, TEST_ENV.JWT_SECRET, {
        subject: student.id,
        issuer: 'studyai-api',
        audience: 'other',
      });

      const cases = {
        garbage: 'not-a-jwt',
        tamperedSignature: `${header}.${payload}.invalidsignature`,
        forged,
        expired,
        algNone,
        wrongAudience,
      };
      for (const [label, token] of Object.entries(cases)) {
        const viaCookie = await request(ctx.app)
          .get('/api/auth/me')
          .set('Cookie', `studyai_session=${token}`);
        expect(viaCookie.status, `${label} (cookie)`).toBe(401);
        const viaHeader = await request(ctx.app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);
        expect(viaHeader.status, `${label} (bearer)`).toBe(401);
      }
      expect(
        (await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${valid}`)).status,
      ).toBe(200);
    });

    it('logout clears the cookie and revokes the token server-side', async () => {
      const student = await registerStudent(ctx);
      const login = await post('/api/auth/login', {
        email: student.email,
        password: TEST_PASSWORD,
      });
      const token = sessionCookie(login)!.split(';')[0]!.split('=')[1]!;

      const logout = await student.post('/api/auth/logout');
      expect(logout.status).toBe(204);
      expect(sessionCookie(logout)).toMatch(/studyai_session=;/);

      const reuse = await request(ctx.app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(reuse.status).toBe(401);
    });

    it('suspended accounts cannot log in and existing sessions stop working immediately', async () => {
      const student = await registerStudent(ctx);
      await ctx.db.update(users).set({ isActive: false }).where(eq(users.id, student.id));
      expect((await student.get('/api/auth/me')).status).toBe(401);
      const login = await post('/api/auth/login', {
        email: student.email,
        password: TEST_PASSWORD,
      });
      expect(login.status).toBe(403);
    });
  });

  describe('profile management', () => {
    it('updates allowed profile fields only', async () => {
      const student = await registerStudent(ctx);
      const ok = await student.patch('/api/users/me', {
        fullName: 'Renamed Student',
        academicYear: 3,
      });
      expect(ok.status).toBe(200);
      expect(ok.body.user).toMatchObject({ fullName: 'Renamed Student', academicYear: 3 });

      const escalate = await student.patch('/api/users/me', { role: 'ADMIN' });
      expect(escalate.status).toBe(400);
      const email = await student.patch('/api/users/me', { email: 'other@college.edu' });
      expect(email.status).toBe(400);
    });

    it('changes the password, rejecting a wrong current password', async () => {
      const student = await registerStudent(ctx);
      const wrong = await student.patch('/api/users/me/password', {
        currentPassword: 'Nope!Nope123',
        newPassword: 'N3w!Password99',
      });
      expect(wrong.status).toBe(400);

      const ok = await student.patch('/api/users/me/password', {
        currentPassword: TEST_PASSWORD,
        newPassword: 'N3w!Password99',
      });
      expect(ok.status).toBe(200);
      expect((await student.get('/api/auth/me')).status).toBe(200);

      const oldLogin = await post('/api/auth/login', {
        email: student.email,
        password: TEST_PASSWORD,
      });
      expect(oldLogin.status).toBe(401);
      const newLogin = await post('/api/auth/login', {
        email: student.email,
        password: 'N3w!Password99',
      });
      expect(newLogin.status).toBe(200);
    });
  });
});
