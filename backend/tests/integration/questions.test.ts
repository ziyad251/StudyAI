import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { notifications, questions } from '../../src/db/schema.js';
import {
  askQuestion,
  createTestContext,
  createUserAndLogin,
  questionPayload,
  registerStudent,
  subjectId,
  type Client,
  type TestContext,
} from '../helpers/app.js';

describe('questions', () => {
  let ctx: TestContext;
  let student: Client;
  let other: Client;
  let dbms: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    student = await registerStudent(ctx);
    other = await registerStudent(ctx);
    dbms = await subjectId(ctx, 'CS202');
  });
  afterAll(() => ctx.close());

  describe('creation', () => {
    it('creates a question with a manually chosen subject and stores the AI category', async () => {
      const res = await student.post('/api/questions', questionPayload({ subjectId: dbms }));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'How does normalization work in DBMS?',
        status: 'OPEN',
        category: 'Normalization',
        subject: { id: dbms, code: 'CS202', name: 'Database Management Systems' },
        isOwn: true,
        answerCount: 0,
      });
      const [row] = await ctx.db.select().from(questions).where(eq(questions.id, res.body.id));
      expect(row!.authorId).toBe(student.id);
      expect(row!.aiConfidence).toBeCloseTo(0.93);
    });

    it('uses the AI-suggested subject when none is chosen and confidence is high', async () => {
      const res = await student.post('/api/questions', {
        title: 'When should I use a semaphore instead of a mutex?',
        description: 'Both protect critical sections, so what is the practical difference?',
      });
      expect(res.status).toBe(201);
      expect(res.body.subject.code).toBe('CS203');
    });

    it('requires a manual subject when AI confidence is low', async () => {
      const res = await student.post('/api/questions', {
        title: 'A rather vague question here',
        description: 'Something general that the classifier cannot place confidently at all.',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SUBJECT_REQUIRED');
      expect(res.body.error.details.suggestion.subjectCode).toBe('CS201');
    });

    it('falls back to manual subject selection when Gemini is unavailable', async () => {
      ctx.ai.fail('upstream');
      try {
        const auto = await student.post('/api/questions', questionPayload());
        expect(auto.status).toBe(422);
        expect(auto.body.error.code).toBe('SUBJECT_REQUIRED');

        const manual = await student.post('/api/questions', questionPayload({ subjectId: dbms }));
        expect(manual.status).toBe(201);
        expect(manual.body.category).toBe('Database');
      } finally {
        ctx.ai.failWith = null;
      }
    });

    it('warns about personal information and requires explicit acknowledgement', async () => {
      const payload = questionPayload({
        subjectId: dbms,
        description:
          'I am Rahul, roll no 21CS1043, call me on +91 98765 43210 to explain normalization.',
      });
      const warned = await student.post('/api/questions', payload);
      expect(warned.status).toBe(422);
      expect(warned.body.error.code).toBe('PERSONAL_INFO_WARNING');
      const types = warned.body.error.details.findings.map((f: { type: string }) => f.type);
      expect(types).toEqual(expect.arrayContaining(['PHONE', 'SELF_IDENTIFICATION']));
      expect(JSON.stringify(warned.body)).not.toContain('98765 43210');

      const acknowledged = await student.post('/api/questions', {
        ...payload,
        acknowledgePersonalInfo: true,
      });
      expect(acknowledged.status).toBe(201);
    });

    it('validates input', async () => {
      const res = await student.post('/api/questions', {
        title: 'short',
        description: 'tiny',
        subjectId: 'nope',
      });
      expect(res.status).toBe(400);
      const paths = res.body.error.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(expect.arrayContaining(['title', 'description', 'subjectId']));
    });

    it('rejects an unknown subject', async () => {
      const res = await student.post(
        '/api/questions',
        questionPayload({ subjectId: '00000000-0000-4000-8000-000000000000' }),
      );
      expect(res.status).toBe(400);
    });

    it('rejects unknown fields such as authorId (no mass assignment)', async () => {
      const res = await student.post(
        '/api/questions',
        questionPayload({ subjectId: dbms, authorId: other.id }),
      );
      expect(res.status).toBe(400);
    });

    it('notifies teachers assigned to the subject', async () => {
      const teacher = await createUserAndLogin(ctx, 'TEACHER', { subjectCodes: ['CS202'] });
      await askQuestion(student, ctx, { title: 'What is a functional dependency exactly?' });
      const rows = await ctx.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, teacher.id));
      expect(rows.some((n) => n.type === 'NEW_QUESTION_IN_SUBJECT')).toBe(true);
    });
  });

  describe('browsing', () => {
    let searchCtx: TestContext;
    let viewer: Client;

    beforeAll(async () => {
      searchCtx = await createTestContext();
      const author = await registerStudent(searchCtx);
      viewer = await registerStudent(searchCtx);
      const os = await subjectId(searchCtx, 'CS203');
      await askQuestion(author, searchCtx, {
        title: 'Explain the third normal form please',
        description: 'Transitive dependencies confuse me in relational design.',
      });
      await askQuestion(author, searchCtx, {
        title: 'How does B-tree indexing speed up queries?',
        description: 'Why are B-trees preferred over binary search trees in databases?',
      });
      await askQuestion(author, searchCtx, {
        subjectId: os,
        title: 'What causes a deadlock between threads?',
        description: 'Explain the four Coffman conditions with an example.',
      });
    });
    afterAll(() => searchCtx.close());

    it('paginates', async () => {
      const page1 = await viewer.get('/api/questions?pageSize=2&page=1');
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      const page2 = await viewer.get('/api/questions?pageSize=2&page=2');
      expect(page2.body.items).toHaveLength(1);
    });

    it('filters by subject and status', async () => {
      const os = await subjectId(searchCtx, 'CS203');
      const bySubject = await viewer.get(`/api/questions?subjectId=${os}`);
      expect(bySubject.body.items).toHaveLength(1);
      expect(bySubject.body.items[0].subject.code).toBe('CS203');
      const answered = await viewer.get('/api/questions?status=ANSWERED');
      expect(answered.body.items).toHaveLength(0);
    });

    it('supports full-text search (with stemming) and partial title matches', async () => {
      const stemmed = await viewer.get('/api/questions?search=deadlocks');
      expect(stemmed.body.items.map((q: { title: string }) => q.title)).toEqual([
        'What causes a deadlock between threads?',
      ]);
      const partial = await viewer.get('/api/questions?search=B-tre');
      expect(partial.body.items).toHaveLength(1);
      const none = await viewer.get(`/api/questions?search=${encodeURIComponent("%' OR 1=1 --")}`);
      expect(none.status).toBe(200);
      expect(none.body.items).toHaveLength(0);
    });

    it('sorts oldest first when requested', async () => {
      const res = await viewer.get('/api/questions?sort=oldest');
      expect(res.body.items[0].title).toBe('Explain the third normal form please');
    });

    it('rejects invalid query parameters', async () => {
      expect((await viewer.get('/api/questions?pageSize=500')).status).toBe(400);
      expect((await viewer.get('/api/questions?status=DELETED')).status).toBe(400);
    });
  });

  describe('editing and deletion', () => {
    it('lets the author edit; others get 403', async () => {
      const q = await askQuestion(student, ctx);
      const edited = await student.patch(`/api/questions/${q.id}`, {
        title: 'How does normalisation (2NF vs 3NF) work?',
      });
      expect(edited.status).toBe(200);
      expect(edited.body.title).toBe('How does normalisation (2NF vs 3NF) work?');

      const forbidden = await other.patch(`/api/questions/${q.id}`, {
        title: 'Hijacked title that is long',
      });
      expect(forbidden.status).toBe(403);
    });

    it('lets the author close and reopen a question', async () => {
      const q = await askQuestion(student, ctx);
      const closed = await student.patch(`/api/questions/${q.id}`, { status: 'CLOSED' });
      expect(closed.body.status).toBe('CLOSED');
      const blocked = await other.post(`/api/questions/${q.id}/answers`, {
        content: 'An answer to a closed question.',
      });
      expect(blocked.status).toBe(409);
      const reopened = await student.patch(`/api/questions/${q.id}`, { status: 'OPEN' });
      expect(reopened.body.status).toBe('OPEN');
    });

    it('deletes unanswered questions, but not answered ones', async () => {
      const q1 = await askQuestion(student, ctx);
      expect((await other.delete(`/api/questions/${q1.id}`)).status).toBe(403);
      expect((await student.delete(`/api/questions/${q1.id}`)).status).toBe(204);
      expect((await student.get(`/api/questions/${q1.id}`)).status).toBe(404);

      const q2 = await askQuestion(student, ctx);
      await other.post(`/api/questions/${q2.id}/answers`, { content: 'Here is a helpful answer.' });
      const res = await student.delete(`/api/questions/${q2.id}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('QUESTION_HAS_ANSWERS');
    });

    it('hides FLAGGED questions from everyone but the author', async () => {
      const q = await askQuestion(student, ctx);
      await ctx.db.update(questions).set({ status: 'FLAGGED' }).where(eq(questions.id, q.id));
      expect((await other.get(`/api/questions/${q.id}`)).status).toBe(404);
      expect(
        (await other.get('/api/questions')).body.items.some((x: { id: string }) => x.id === q.id),
      ).toBe(false);
      expect((await student.get(`/api/questions/${q.id}`)).status).toBe(200);
      expect(
        (await student.patch(`/api/questions/${q.id}`, { title: 'Trying to edit a flagged one' }))
          .status,
      ).toBe(403);
    });
  });

  it('returns student statistics for the dashboard', async () => {
    const fresh = await registerStudent(ctx);
    await askQuestion(fresh, ctx);
    const q = await askQuestion(fresh, ctx);
    await fresh.patch(`/api/questions/${q.id}`, { status: 'CLOSED' });
    const res = await fresh.get('/api/users/me/statistics');
    expect(res.body).toEqual({ totalQuestions: 2, open: 1, answered: 0, closed: 1, flagged: 0 });
  });
});
