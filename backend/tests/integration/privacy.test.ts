import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { users } from '../../src/db/schema.js';
import {
  askQuestion,
  createTestContext,
  createUserAndLogin,
  registerStudent,
  type Client,
  type TestContext,
} from '../helpers/app.js';
import { expectNoPrivateData } from '../helpers/privacy.js';

describe('privacy: anonymous questions', () => {
  let ctx: TestContext;
  let author: Client;
  let classmate: Client;
  let teacher: Client;
  let admin: Client;
  let questionId: string;
  let authorSecrets: string[];

  beforeAll(async () => {
    ctx = await createTestContext();
    author = await registerStudent(ctx, { fullName: 'Priya Sharma', rollNumber: '21CS1043' });
    classmate = await registerStudent(ctx, { fullName: 'Arjun Mehta' });
    teacher = await createUserAndLogin(ctx, 'TEACHER', {
      subjectCodes: ['CS202'],
      fullName: 'Dr. Anita Rao',
    });
    admin = await createUserAndLogin(ctx, 'ADMIN');

    const [authorRow] = await ctx.db.select().from(users).where(eq(users.id, author.id));
    authorSecrets = [author.id, author.email, 'Priya Sharma', '21CS1043', authorRow!.passwordHash];

    questionId = (await askQuestion(author, ctx)).id;
    await author.post(`/api/questions/${questionId}/answers`, {
      content: 'Partial answer from the asker myself.',
    });
    await author.post(`/api/questions/${questionId}/comments`, { content: 'Thanks in advance!' });
    await classmate.post(`/api/questions/${questionId}/answers`, {
      content: 'Classmate explanation of 2NF and 3NF.',
    });
  });

  afterAll(() => ctx.close());

  it('1. public question responses never contain author ids', async () => {
    const detail = await classmate.get(`/api/questions/${questionId}`);
    expect(detail.status).toBe(200);
    expect(detail.body).not.toHaveProperty('authorId');
    expectNoPrivateData(detail.body, { secrets: authorSecrets });

    const list = await classmate.get('/api/questions');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    expectNoPrivateData(list.body, { secrets: authorSecrets });
  });

  it('2. public question responses never contain email addresses', async () => {
    for (const client of [classmate, teacher, admin]) {
      const res = await client.get(`/api/questions/${questionId}`);
      expect(JSON.stringify(res.body)).not.toMatch(/@college\.edu/);
    }
  });

  it('exposes exactly the documented public question fields', async () => {
    const res = await classmate.get(`/api/questions/${questionId}`);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'answerCount',
        'category',
        'commentCount',
        'createdAt',
        'description',
        'hasAcceptedAnswer',
        'hasTeacherAnswer',
        'id',
        'isOwn',
        'status',
        'subject',
        'title',
        'updatedAt',
      ].sort(),
    );
    expect(Object.keys(res.body.subject).sort()).toEqual(['code', 'id', 'name']);
  });

  it('isOwn only tells the requester whether the question is theirs', async () => {
    expect((await author.get(`/api/questions/${questionId}`)).body.isOwn).toBe(true);
    expect((await classmate.get(`/api/questions/${questionId}`)).body.isOwn).toBe(false);
  });

  it('answers and comments by students are anonymous; teachers are identified by role', async () => {
    await teacher.post(`/api/questions/${questionId}/answers`, {
      content: 'Teacher explanation of normal forms.',
    });

    const answers = await classmate.get(`/api/questions/${questionId}/answers`);
    expect(answers.status).toBe(200);
    expectNoPrivateData(answers.body, {
      secrets: [
        ...authorSecrets,
        classmate.id,
        classmate.email,
        'Arjun Mehta',
        teacher.id,
        teacher.email,
      ],
    });

    const teacherAnswer = answers.body.items.find(
      (a: { author: { role: string } }) => a.author.role === 'TEACHER',
    );
    expect(teacherAnswer.author.displayName).toBe('Dr. Anita Rao');
    const studentAnswers = answers.body.items.filter(
      (a: { author: { role: string } }) => a.author.role === 'STUDENT',
    );
    expect(studentAnswers).toHaveLength(2);
    for (const a of studentAnswers) expect(a.author.displayName).toBe('Anonymous student');

    const comments = await classmate.get(`/api/questions/${questionId}/comments`);
    expectNoPrivateData(comments.body, { secrets: authorSecrets });
    expect(comments.body.items[0].author).toEqual({
      role: 'STUDENT',
      displayName: 'Anonymous student',
      isQuestionAuthor: true,
    });
  });

  it('admins moderate content without seeing who wrote it', async () => {
    const queue = await admin.get('/api/admin/questions');
    expect(queue.status).toBe(200);
    expectNoPrivateData(queue.body, { secrets: authorSecrets });

    await classmate.post('/api/reports', {
      targetType: 'QUESTION',
      targetId: questionId,
      reason: 'OFF_TOPIC',
    });
    const reports = await admin.get('/api/admin/reports');
    expect(reports.status).toBe(200);
    expectNoPrivateData(reports.body, {
      secrets: [...authorSecrets, classmate.id, classmate.email],
    });
  });

  it('notifications never reveal who acted', async () => {
    const res = await author.get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expectNoPrivateData(res.body, {
      secrets: [classmate.id, classmate.email, 'Arjun Mehta', teacher.id, teacher.email],
    });
  });

  it('3. password hashes never appear in any API response', async () => {
    const responses = await Promise.all([
      author.get('/api/auth/me'),
      admin.get('/api/admin/users?pageSize=50'),
      admin.get(`/api/admin/users/${author.id}`),
      classmate.get('/api/questions'),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/\$2[aby]\$/);
      expect(body).not.toMatch(/password/i);
    }
  });

  it('own profile does not include internal identifiers', async () => {
    const res = await author.get('/api/auth/me');
    expect(res.body.user).not.toHaveProperty('id');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('tokenVersion');
    expect(res.body.user.email).toBe(author.email);
  });

  it('9. users cannot access private profile information belonging to others', async () => {
    const direct = await classmate.get(`/api/admin/users/${author.id}`);
    expect(direct.status).toBe(403);
    const list = await classmate.get('/api/admin/users');
    expect(list.status).toBe(403);
    const teacherAttempt = await teacher.get(`/api/admin/users/${author.id}`);
    expect(teacherAttempt.status).toBe(403);
    const guess = await classmate.get(`/api/users/${author.id}`);
    expect(guess.status).toBe(404);
  });

  it('a filter on "mine" cannot be abused to discover another user’s questions', async () => {
    const res = await classmate.get('/api/questions?mine=true');
    expect(res.body.items.every((q: { isOwn: boolean }) => q.isOwn)).toBe(true);
    expect(res.body.items.find((q: { id: string }) => q.id === questionId)).toBeUndefined();
  });

  it('never sends user identity to the AI provider', async () => {
    ctx.ai.calls.length = 0;
    await author.post('/api/ai/ask', { questionId });
    await author.post('/api/ai/classify-question', {
      title: 'Explain SQL joins',
      description: 'inner vs outer joins',
    });
    expect(ctx.ai.calls.length).toBeGreaterThan(0);
    for (const call of ctx.ai.calls) {
      for (const secret of authorSecrets.slice(0, 4)) expect(call.prompt).not.toContain(secret);
    }
  });

  it('unauthenticated visitors cannot browse questions at all', async () => {
    const res = await request(ctx.app).get('/api/questions');
    expect(res.status).toBe(401);
  });
});
