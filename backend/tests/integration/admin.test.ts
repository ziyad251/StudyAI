import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { reports, users } from '../../src/db/schema.js';
import {
  TEST_PASSWORD,
  askQuestion,
  createTestContext,
  createUserAndLogin,
  registerStudent,
  subjectId,
  uniqueEmail,
  type Client,
  type TestContext,
} from '../helpers/app.js';

describe('administration and moderation', () => {
  let ctx: TestContext;
  let admin: Client;
  let student: Client;

  beforeAll(async () => {
    ctx = await createTestContext({ configure: (c) => (c.autoFlagReportThreshold = 2) });
    admin = await createUserAndLogin(ctx, 'ADMIN');
    student = await registerStudent(ctx);
  });
  afterAll(() => ctx.close());

  describe('user provisioning', () => {
    it('admins provision teacher accounts with subjects, who can then log in', async () => {
      const email = uniqueEmail('newteacher');
      const res = await admin.post('/api/admin/users', {
        fullName: 'Dr. New Teacher',
        email,
        password: TEST_PASSWORD,
        role: 'TEACHER',
        department: 'Computer Science',
        subjectIds: [await subjectId(ctx, 'CS202'), await subjectId(ctx, 'CS203')],
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ role: 'TEACHER', email, isActive: true });
      expect(res.body.subjects.map((s: { code: string }) => s.code).sort()).toEqual([
        'CS202',
        'CS203',
      ]);
      expect(res.body).not.toHaveProperty('passwordHash');

      const login = await request(ctx.app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email, password: TEST_PASSWORD });
      expect(login.body.user.role).toBe('TEACHER');
    });

    it('rejects subjects for non-teachers and weak passwords', async () => {
      const weak = await admin.post('/api/admin/users', {
        fullName: 'Weak',
        email: uniqueEmail(),
        password: 'weak',
        role: 'TEACHER',
        department: 'CS',
      });
      expect(weak.status).toBe(400);
      const subjectsForAdmin = await admin.post('/api/admin/users', {
        fullName: 'Admin Two',
        email: uniqueEmail(),
        password: TEST_PASSWORD,
        role: 'ADMIN',
        department: 'Admin',
        subjectIds: [await subjectId(ctx, 'CS202')],
      });
      expect(subjectsForAdmin.status).toBe(400);
    });

    it('searches and filters users', async () => {
      const res = await admin.get('/api/admin/users?role=STUDENT');
      expect(res.status).toBe(200);
      expect(res.body.items.every((u: { role: string }) => u.role === 'STUDENT')).toBe(true);
      const search = await admin.get(
        `/api/admin/users?search=${encodeURIComponent(student.email)}`,
      );
      expect(search.body.items).toHaveLength(1);
    });

    it('suspends a user, revoking their session', async () => {
      const target = await registerStudent(ctx);
      const res = await admin.patch(`/api/admin/users/${target.id}`, { isActive: false });
      expect(res.body.isActive).toBe(false);
      expect((await target.get('/api/auth/me')).status).toBe(401);
    });

    it('protects against admins locking themselves out', async () => {
      expect((await admin.patch(`/api/admin/users/${admin.id}`, { role: 'STUDENT' })).status).toBe(
        400,
      );
      expect((await admin.patch(`/api/admin/users/${admin.id}`, { isActive: false })).status).toBe(
        400,
      );
    });

    it('assigns subjects to teachers only', async () => {
      const teacher = await createUserAndLogin(ctx, 'TEACHER');
      const ok = await admin.put(`/api/admin/users/${teacher.id}/subjects`, {
        subjectIds: [await subjectId(ctx, 'MA101')],
      });
      expect(ok.body.subjects).toHaveLength(1);
      const notTeacher = await admin.put(`/api/admin/users/${student.id}/subjects`, {
        subjectIds: [],
      });
      expect(notTeacher.status).toBe(400);
    });
  });

  describe('subjects', () => {
    it('creates, updates and deactivates subjects', async () => {
      const created = await admin.post('/api/subjects', {
        name: 'Cloud Computing',
        code: 'cs401',
        category: 'Systems',
      });
      expect(created.status).toBe(201);
      expect(created.body.code).toBe('CS401');

      const dup = await admin.post('/api/subjects', {
        name: 'cloud computing',
        code: 'CS999',
        category: 'Systems',
      });
      expect(dup.status).toBe(409);

      const deactivated = await admin.patch(`/api/subjects/${created.body.id}`, {
        isActive: false,
      });
      expect(deactivated.body.isActive).toBe(false);
      const publicList = await student.get('/api/subjects');
      expect(publicList.body.items.some((s: { code: string }) => s.code === 'CS401')).toBe(false);
      const adminList = await admin.get('/api/subjects?includeInactive=true');
      expect(adminList.body.items.some((s: { code: string }) => s.code === 'CS401')).toBe(true);
      const sneaky = await student.get('/api/subjects?includeInactive=true');
      expect(sneaky.body.items.some((s: { code: string }) => s.code === 'CS401')).toBe(false);
    });
  });

  describe('reports and moderation', () => {
    it('users report content once; reaching the threshold auto-flags a question', async () => {
      const q = await askQuestion(student, ctx);
      const r1 = await registerStudent(ctx);
      const r2 = await registerStudent(ctx);

      expect(
        (
          await student.post('/api/reports', {
            targetType: 'QUESTION',
            targetId: q.id,
            reason: 'SPAM',
          })
        ).status,
      ).toBe(400);
      expect(
        (await r1.post('/api/reports', { targetType: 'QUESTION', targetId: q.id, reason: 'SPAM' }))
          .status,
      ).toBe(201);
      const again = await r1.post('/api/reports', {
        targetType: 'QUESTION',
        targetId: q.id,
        reason: 'OTHER',
      });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('ALREADY_REPORTED');

      await r2.post('/api/reports', {
        targetType: 'QUESTION',
        targetId: q.id,
        reason: 'INAPPROPRIATE',
      });
      expect((await r1.get(`/api/questions/${q.id}`)).status).toBe(404);
      expect((await student.get(`/api/questions/${q.id}`)).body.status).toBe('FLAGGED');

      const queue = await admin.get('/api/admin/questions?status=FLAGGED');
      const item = queue.body.items.find((x: { id: string }) => x.id === q.id);
      expect(item.openReportCount).toBe(2);
    });

    it('admins restore a flagged question, dismissing its reports', async () => {
      const q = await askQuestion(student, ctx);
      const reporter = await registerStudent(ctx);
      await reporter.post('/api/reports', {
        targetType: 'QUESTION',
        targetId: q.id,
        reason: 'SPAM',
      });
      await admin.patch(`/api/admin/questions/${q.id}/moderate`, {
        action: 'FLAG',
        note: 'Checking',
      });
      expect((await reporter.get(`/api/questions/${q.id}`)).status).toBe(404);

      const restored = await admin.patch(`/api/admin/questions/${q.id}/moderate`, {
        action: 'RESTORE',
      });
      expect(restored.status).toBe(200);
      expect((await reporter.get(`/api/questions/${q.id}`)).body.status).toBe('OPEN');
    });

    it('resolving an answer report with removal deletes the answer but keeps the audit record', async () => {
      const q = await askQuestion(student, ctx);
      const troll = await registerStudent(ctx);
      const bad = await troll.post(`/api/questions/${q.id}/answers`, {
        content: 'Spam spam spam buy now!!!',
      });
      await student.post('/api/reports', {
        targetType: 'ANSWER',
        targetId: bad.body.id,
        reason: 'SPAM',
      });

      const list = await admin.get('/api/admin/reports?status=OPEN&targetType=ANSWER');
      const report = list.body.items.find((r: { targetId: string }) => r.targetId === bad.body.id);
      expect(report.contentSnapshot).toBe('Spam spam spam buy now!!!');
      expect(report.question.id).toBe(q.id);

      const resolved = await admin.patch(`/api/admin/reports/${report.id}`, {
        status: 'RESOLVED',
        removeContent: true,
        resolutionNote: 'Spam removed',
      });
      expect(resolved.status).toBe(200);
      expect((await student.get(`/api/questions/${q.id}/answers`)).body.items).toHaveLength(0);

      const [record] = await ctx.db.select().from(reports).where(eq(reports.id, report.id));
      expect(record).toMatchObject({
        status: 'RESOLVED',
        answerId: null,
        resolutionNote: 'Spam removed',
      });

      const again = await admin.patch(`/api/admin/reports/${report.id}`, { status: 'DISMISSED' });
      expect(again.status).toBe(409);
    });

    it('suspends an anonymous author through moderation without revealing them', async () => {
      const abuser = await registerStudent(ctx);
      const q = await askQuestion(abuser, ctx);
      const res = await admin.patch(`/api/admin/questions/${q.id}/moderate`, {
        action: 'DELETE',
        suspendAuthor: true,
      });
      expect(res.body).toEqual({ id: q.id, action: 'DELETE', authorSuspended: true });
      expect(JSON.stringify(res.body)).not.toContain(abuser.id);

      const [row] = await ctx.db.select().from(users).where(eq(users.id, abuser.id));
      expect(row!.isActive).toBe(false);
      expect((await abuser.get('/api/auth/me')).status).toBe(401);
    });
  });

  it('reports platform statistics', async () => {
    const res = await admin.get('/api/admin/statistics');
    expect(res.status).toBe(200);
    expect(res.body.users.students).toBeGreaterThan(0);
    expect(res.body.questions.total).toBeGreaterThan(0);
    expect(res.body.questionsPerDay).toHaveLength(30);
    expect(res.body.questionsPerDay.at(-1).count).toBeGreaterThan(0);
    expect(
      res.body.questionsPerSubject.find((s: { code: string }) => s.code === 'CS202').questions,
    ).toBeGreaterThan(0);
  });
});

describe('teacher dashboard', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('shows only questions in assigned subjects, with statistics', async () => {
    const student = await registerStudent(ctx);
    const teacher = await createUserAndLogin(ctx, 'TEACHER', { subjectCodes: ['CS202'] });
    const dbmsQ = await askQuestion(student, ctx);
    await askQuestion(student, ctx, {
      subjectId: await subjectId(ctx, 'CS203'),
      title: 'Explain round robin scheduling',
    });

    const list = await teacher.get('/api/teacher/questions');
    expect(list.body.items.map((q: { id: string }) => q.id)).toEqual([dbmsQ.id]);

    const unassigned = await teacher.get(
      `/api/teacher/questions?subjectId=${await subjectId(ctx, 'CS203')}`,
    );
    expect(unassigned.status).toBe(400);

    await teacher.post(`/api/questions/${dbmsQ.id}/answers`, {
      content: 'Teacher answer for the dashboard.',
    });
    const stats = await teacher.get('/api/teacher/statistics');
    expect(stats.body).toMatchObject({
      assignedSubjects: 1,
      totalQuestions: 1,
      answeredQuestions: 1,
      myAnswers: 1,
    });

    const mine = await teacher.get('/api/teacher/answers');
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].question).toMatchObject({
      id: dbmsQ.id,
      subject: 'Database Management Systems',
    });

    const unanswered = await teacher.get('/api/teacher/questions?unanswered=true');
    expect(unanswered.body.items).toHaveLength(0);
  });
});
