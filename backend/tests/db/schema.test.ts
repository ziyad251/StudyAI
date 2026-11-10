import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../helpers/db.js';
import { answers, questions, reports, subjects, users } from '../../src/db/schema.js';
import { seedDemoData, seedSubjects } from '../../src/db/seeders.js';
import { SUBJECT_SEED } from '../../src/db/seed-data.js';

function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
}

async function expectPgError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, 'expected the database to reject the statement').toBeDefined();
  expect(pgCode(error)).toBe(code);
}

describe('database schema and migrations', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let userId: string;
  let subjectId: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'a@college.edu', passwordHash: 'x', fullName: 'A', department: 'CS' })
      .returning();
    userId = user!.id;
    const [subject] = await ctx.db.select().from(subjects).limit(1);
    subjectId = subject!.id;
  });

  afterAll(() => ctx.close());

  it('applies migrations and seeds every subject', async () => {
    const rows = await ctx.db.select().from(subjects);
    expect(rows).toHaveLength(SUBJECT_SEED.length);
  });

  it('subject seeding is idempotent', async () => {
    expect(await seedSubjects(ctx.db)).toBe(0);
  });

  it('defaults new users to the STUDENT role with UUID ids', async () => {
    const [user] = await ctx.db.select().from(users).where(eq(users.id, userId));
    expect(user!.role).toBe('STUDENT');
    expect(user!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('enforces unique emails', async () => {
    await expectPgError(
      ctx.db
        .insert(users)
        .values({ email: 'a@college.edu', passwordHash: 'x', fullName: 'B', department: 'CS' }),
      '23505',
    );
  });

  it('rejects an academic year outside 1–6', async () => {
    await expectPgError(
      ctx.db.insert(users).values({
        email: 'year@college.edu',
        passwordHash: 'x',
        fullName: 'Y',
        department: 'CS',
        academicYear: 9,
      }),
      '23514',
    );
  });

  it('enforces foreign keys on questions', async () => {
    await expectPgError(
      ctx.db.insert(questions).values({
        authorId: '00000000-0000-0000-0000-000000000000',
        subjectId,
        title: 't',
        description: 'd',
      }),
      '23503',
    );
  });

  it('allows only one accepted answer per question', async () => {
    const [q] = await ctx.db
      .insert(questions)
      .values({ authorId: userId, subjectId, title: 'Q', description: 'D' })
      .returning();
    await ctx.db
      .insert(answers)
      .values({ questionId: q!.id, authorId: userId, content: 'A1', isAccepted: true });
    await expectPgError(
      ctx.db
        .insert(answers)
        .values({ questionId: q!.id, authorId: userId, content: 'A2', isAccepted: true }),
      '23505',
    );
  });

  it('requires a report target that matches its type, and one report per user per target', async () => {
    const [q] = await ctx.db
      .insert(questions)
      .values({ authorId: userId, subjectId, title: 'R', description: 'D' })
      .returning();

    const base = { reporterId: userId, contentSnapshot: 'R' };
    await expectPgError(
      ctx.db
        .insert(reports)
        .values({ ...base, targetType: 'ANSWER', questionId: q!.id, reason: 'SPAM' }),
      '23514',
    );

    await ctx.db
      .insert(reports)
      .values({ ...base, targetType: 'QUESTION', questionId: q!.id, reason: 'SPAM' });
    await expectPgError(
      ctx.db
        .insert(reports)
        .values({ ...base, targetType: 'QUESTION', questionId: q!.id, reason: 'OTHER' }),
      '23505',
    );
  });

  it('keeps the moderation record when reported content is deleted', async () => {
    const [q] = await ctx.db
      .insert(questions)
      .values({ authorId: userId, subjectId, title: 'Del', description: 'D' })
      .returning();
    const [a] = await ctx.db
      .insert(answers)
      .values({ questionId: q!.id, authorId: userId, content: 'x' })
      .returning();
    const [r] = await ctx.db
      .insert(reports)
      .values({
        reporterId: userId,
        targetType: 'ANSWER',
        answerId: a!.id,
        contentSnapshot: 'x',
        reason: 'SPAM',
      })
      .returning();

    await ctx.db.delete(answers).where(eq(answers.id, a!.id));
    const [after] = await ctx.db.select().from(reports).where(eq(reports.id, r!.id));
    expect(after).toBeDefined();
    expect(after!.answerId).toBeNull();
    expect(after!.contentSnapshot).toBe('x');
  });

  it('seeds demo data idempotently', async () => {
    const first = await seedDemoData(ctx.db, 'Demo#Password1');
    const second = await seedDemoData(ctx.db, 'Demo#Password1');
    expect(second).toEqual(first);
  });
});
