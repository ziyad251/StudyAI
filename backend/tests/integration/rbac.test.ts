import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  askQuestion,
  createTestContext,
  createUserAndLogin,
  registerStudent,
  type Client,
  type TestContext,
} from '../helpers/app.js';

describe('role-based access control', () => {
  let ctx: TestContext;
  let student: Client;
  let teacher: Client;
  let admin: Client;
  let questionId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    student = await registerStudent(ctx);
    teacher = await createUserAndLogin(ctx, 'TEACHER', { subjectCodes: ['CS202'] });
    admin = await createUserAndLogin(ctx, 'ADMIN');
    questionId = (await askQuestion(student, ctx)).id;
  });
  afterAll(() => ctx.close());

  const adminEndpoints: [string, string][] = [
    ['get', '/api/admin/users'],
    ['post', '/api/admin/users'],
    ['get', '/api/admin/statistics'],
    ['get', '/api/admin/questions'],
    ['get', '/api/admin/reports'],
    ['patch', '/api/admin/questions/00000000-0000-4000-8000-000000000000/moderate'],
    ['patch', '/api/admin/reports/00000000-0000-4000-8000-000000000000'],
    ['post', '/api/subjects'],
    ['patch', '/api/subjects/00000000-0000-4000-8000-000000000000'],
  ];

  it('4. students cannot access admin endpoints', async () => {
    for (const [method, url] of adminEndpoints) {
      const res = await (
        student as unknown as Record<
          string,
          (u: string, b?: object) => Promise<{ status: number; body: { error: { code: string } } }>
        >
      )[method]!(url, {});
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('teachers cannot access admin endpoints', async () => {
    for (const [method, url] of adminEndpoints) {
      const res = await (
        teacher as unknown as Record<string, (u: string, b?: object) => Promise<{ status: number }>>
      )[method]!(url, {});
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(403);
    }
  });

  it('admins can access admin endpoints', async () => {
    expect((await admin.get('/api/admin/users')).status).toBe(200);
    expect((await admin.get('/api/admin/statistics')).status).toBe(200);
    expect((await admin.get('/api/admin/questions')).status).toBe(200);
    expect((await admin.get('/api/admin/reports')).status).toBe(200);
  });

  it('only teachers can use teacher endpoints', async () => {
    for (const url of [
      '/api/teacher/questions',
      '/api/teacher/statistics',
      '/api/teacher/subjects',
      '/api/teacher/answers',
    ]) {
      expect((await student.get(url)).status).toBe(403);
      expect((await admin.get(url)).status).toBe(403);
      expect((await teacher.get(url)).status).toBe(200);
    }
  });

  it('only students can ask questions and use the question AI helpers', async () => {
    const body = {
      title: 'Teachers should not be able to post this',
      description: 'This is a question body that is long enough.',
    };
    expect((await teacher.post('/api/questions', body)).status).toBe(403);
    expect((await admin.post('/api/questions', body)).status).toBe(403);
    expect((await teacher.post('/api/ai/classify-question', body)).status).toBe(403);
    expect(
      (await teacher.post('/api/ai/check-personal-information', { text: 'hello there' })).status,
    ).toBe(403);
  });

  it('teachers cannot edit students’ questions or accept answers', async () => {
    expect(
      (
        await teacher.patch(`/api/questions/${questionId}`, {
          title: 'Edited by a teacher, not allowed',
        })
      ).status,
    ).toBe(403);
    const a = await teacher.post(`/api/questions/${questionId}/answers`, {
      content: 'Teacher answer for the matrix test.',
    });
    expect((await teacher.post(`/api/answers/${a.body.id}/accept`)).status).toBe(403);
  });

  it('admins can delete any question, students only their own', async () => {
    const other = await registerStudent(ctx);
    const q = await askQuestion(student, ctx);
    expect((await other.delete(`/api/questions/${q.id}`)).status).toBe(403);
    expect((await admin.delete(`/api/questions/${q.id}`)).status).toBe(204);
  });

  it('notifications are private to their owner', async () => {
    const own = await teacher.get('/api/notifications');
    const notificationId = own.body.items[0]?.id as string;
    expect(notificationId).toBeDefined();
    const res = await student.patch(`/api/notifications/${notificationId}/read`);
    expect(res.status).toBe(404);
    expect((await teacher.patch(`/api/notifications/${notificationId}/read`)).body.isRead).toBe(
      true,
    );
  });

  it('role changes take effect immediately (sessions are revoked)', async () => {
    const promoted = await registerStudent(ctx);
    const target = await admin.get(`/api/admin/users?search=${encodeURIComponent(promoted.email)}`);
    const id = target.body.items[0].id;
    const res = await admin.patch(`/api/admin/users/${id}`, { role: 'TEACHER' });
    expect(res.status).toBe(200);
    expect((await promoted.get('/api/auth/me')).status).toBe(401);
  });
});
