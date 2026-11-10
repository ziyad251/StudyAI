import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { notifications } from '../../src/db/schema.js';
import {
  askQuestion,
  createTestContext,
  createUserAndLogin,
  registerStudent,
  type Client,
  type TestContext,
} from '../helpers/app.js';

describe('answers, comments and votes', () => {
  let ctx: TestContext;
  let asker: Client;
  let classmate: Client;
  let thirdStudent: Client;
  let teacher: Client;
  let admin: Client;

  beforeAll(async () => {
    ctx = await createTestContext();
    asker = await registerStudent(ctx);
    classmate = await registerStudent(ctx);
    thirdStudent = await registerStudent(ctx);
    teacher = await createUserAndLogin(ctx, 'TEACHER', {
      subjectCodes: ['CS202'],
      fullName: 'Prof. Kumar',
    });
    admin = await createUserAndLogin(ctx, 'ADMIN');
  });
  afterAll(() => ctx.close());

  const answer = async (
    client: Client,
    questionId: string,
    content = 'A detailed answer explaining the concept.',
  ) => {
    const res = await client.post(`/api/questions/${questionId}/answers`, { content });
    expect(res.status).toBe(201);
    return res.body as {
      id: string;
      isOwn: boolean;
      author: { role: string; displayName: string };
    };
  };

  it('students and teachers can answer; the response is anonymous for students', async () => {
    const q = await askQuestion(asker, ctx);
    const studentAnswer = await answer(classmate, q.id);
    expect(studentAnswer.isOwn).toBe(true);
    expect(studentAnswer.author).toEqual({
      role: 'STUDENT',
      displayName: 'Anonymous student',
      isQuestionAuthor: false,
    });

    const teacherAnswer = await answer(teacher, q.id);
    expect(teacherAnswer.author).toMatchObject({ role: 'TEACHER', displayName: 'Prof. Kumar' });

    const list = await asker.get(`/api/questions/${q.id}/answers`);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items[0].author.role).toBe('TEACHER');
  });

  it('admins cannot post answers', async () => {
    const q = await askQuestion(asker, ctx);
    const res = await admin.post(`/api/questions/${q.id}/answers`, {
      content: 'Admins should not answer.',
    });
    expect(res.status).toBe(403);
  });

  it('a teacher answer marks the question ANSWERED and notifies the asker', async () => {
    const q = await askQuestion(asker, ctx);
    await answer(teacher, q.id);
    expect((await asker.get(`/api/questions/${q.id}`)).body.status).toBe('ANSWERED');

    const rows = await ctx.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, asker.id), eq(notifications.questionId, q.id)));
    expect(rows.some((n) => n.type === 'NEW_ANSWER' && n.title.includes('teacher'))).toBe(true);
  });

  it('5. students cannot edit or delete other users’ answers', async () => {
    const q = await askQuestion(asker, ctx);
    const a = await answer(classmate, q.id);

    const edit = await thirdStudent.patch(`/api/answers/${a.id}`, {
      content: 'Vandalised answer content!',
    });
    expect(edit.status).toBe(403);
    const editByAsker = await asker.patch(`/api/answers/${a.id}`, {
      content: 'The asker cannot edit it either',
    });
    expect(editByAsker.status).toBe(403);
    const editByTeacher = await teacher.patch(`/api/answers/${a.id}`, {
      content: 'Teachers cannot edit it either',
    });
    expect(editByTeacher.status).toBe(403);
    const del = await thirdStudent.delete(`/api/answers/${a.id}`);
    expect(del.status).toBe(403);

    const list = await asker.get(`/api/questions/${q.id}/answers`);
    expect(list.body.items[0].content).toBe('A detailed answer explaining the concept.');
  });

  it('authors can edit and delete their own answers; admins can delete any', async () => {
    const q = await askQuestion(asker, ctx);
    const a = await answer(classmate, q.id);
    const edited = await classmate.patch(`/api/answers/${a.id}`, {
      content: 'Updated explanation with more detail.',
    });
    expect(edited.status).toBe(200);
    expect(edited.body.content).toBe('Updated explanation with more detail.');
    expect((await classmate.delete(`/api/answers/${a.id}`)).status).toBe(204);

    const b = await answer(classmate, q.id);
    expect((await admin.delete(`/api/answers/${b.id}`)).status).toBe(204);
    expect((await asker.get(`/api/questions/${q.id}/answers`)).body.items).toHaveLength(0);
  });

  it('only the asker can accept an answer, which marks the question ANSWERED', async () => {
    const q = await askQuestion(asker, ctx);
    const a1 = await answer(classmate, q.id);
    const a2 = await answer(thirdStudent, q.id);

    expect((await classmate.post(`/api/answers/${a1.id}/accept`)).status).toBe(403);
    expect((await asker.get(`/api/questions/${q.id}`)).body.status).toBe('OPEN');

    const accepted = await asker.post(`/api/answers/${a1.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.isAccepted).toBe(true);
    expect((await asker.get(`/api/questions/${q.id}`)).body.status).toBe('ANSWERED');

    await asker.post(`/api/answers/${a2.id}/accept`);
    const list = (await asker.get(`/api/questions/${q.id}/answers`)).body.items;
    expect(list.filter((x: { isAccepted: boolean }) => x.isAccepted)).toHaveLength(1);
    expect(list[0].id).toBe(a2.id);

    const notified = await ctx.db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, thirdStudent.id), eq(notifications.type, 'ANSWER_ACCEPTED')),
      );
    expect(notified).toHaveLength(1);
  });

  it('deleting the accepted answer returns the question to OPEN', async () => {
    const q = await askQuestion(asker, ctx);
    const a = await answer(classmate, q.id);
    await asker.post(`/api/answers/${a.id}/accept`);
    await classmate.delete(`/api/answers/${a.id}`);
    expect((await asker.get(`/api/questions/${q.id}`)).body.status).toBe('OPEN');
  });

  it('marks answers useful, once per user, never on one’s own answer', async () => {
    const q = await askQuestion(asker, ctx);
    const a = await answer(classmate, q.id);

    expect((await classmate.put(`/api/answers/${a.id}/useful`)).status).toBe(400);
    await asker.put(`/api/answers/${a.id}/useful`);
    const twice = await asker.put(`/api/answers/${a.id}/useful`);
    expect(twice.body).toMatchObject({ usefulCount: 1, viewerMarkedUseful: true });
    const third = await thirdStudent.put(`/api/answers/${a.id}/useful`);
    expect(third.body.usefulCount).toBe(2);
    const removed = await asker.delete(`/api/answers/${a.id}/useful`);
    expect(removed.body).toMatchObject({ usefulCount: 1, viewerMarkedUseful: false });
  });

  it('comments: anyone may comment; only the author or an admin may delete', async () => {
    const q = await askQuestion(asker, ctx);
    const created = await classmate.post(`/api/questions/${q.id}/comments`, {
      content: 'Great question!',
    });
    expect(created.status).toBe(201);
    expect(created.body.author.displayName).toBe('Anonymous student');

    expect((await thirdStudent.delete(`/api/comments/${created.body.id}`)).status).toBe(403);
    expect((await classmate.delete(`/api/comments/${created.body.id}`)).status).toBe(204);

    const another = await classmate.post(`/api/questions/${q.id}/comments`, {
      content: 'Second comment',
    });
    expect((await admin.delete(`/api/comments/${another.body.id}`)).status).toBe(204);
  });

  it('returns 404 for answers to unknown questions and 400 for malformed ids', async () => {
    expect(
      (
        await classmate.post('/api/questions/00000000-0000-4000-8000-000000000000/answers', {
          content: 'Answer to nothing at all.',
        })
      ).status,
    ).toBe(404);
    expect(
      (await classmate.patch('/api/answers/not-a-uuid', { content: 'Answer to nothing at all.' }))
        .status,
    ).toBe(400);
  });
});
