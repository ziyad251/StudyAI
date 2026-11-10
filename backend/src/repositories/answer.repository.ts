import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { answers, answerVotes, comments, questions, users } from '../db/schema.js';

function publicAuthorColumns(
  authorIdColumn: typeof answers.authorId | typeof comments.authorId,
  viewerId: string,
) {
  return {
    authorRole: users.role,
    authorPublicName: sql<
      string | null
    >`CASE WHEN ${users.role} = 'TEACHER' THEN ${users.fullName} ELSE NULL END`,
    isOwn: sql<boolean>`(${authorIdColumn} = ${viewerId})`,
    isQuestionAuthor: sql<boolean>`(${authorIdColumn} = ${questions.authorId})`,
  };
}

const usefulCountSql = sql<number>`(SELECT count(*) FROM ${answerVotes} WHERE ${answerVotes.answerId} = ${answers.id})::int`;

function answerColumns(viewerId: string) {
  return {
    id: answers.id,
    questionId: answers.questionId,
    content: answers.content,
    isAccepted: answers.isAccepted,
    createdAt: answers.createdAt,
    updatedAt: answers.updatedAt,
    usefulCount: usefulCountSql,
    viewerMarkedUseful: sql<boolean>`EXISTS (
      SELECT 1 FROM ${answerVotes} WHERE ${answerVotes.answerId} = ${answers.id} AND ${answerVotes.userId} = ${viewerId}
    )`,
    ...publicAuthorColumns(answers.authorId, viewerId),
  };
}

function commentColumns(viewerId: string) {
  return {
    id: comments.id,
    questionId: comments.questionId,
    content: comments.content,
    createdAt: comments.createdAt,
    updatedAt: comments.updatedAt,
    ...publicAuthorColumns(comments.authorId, viewerId),
  };
}

export const answerRepository = {
  async listPublicForQuestion(db: Database, questionId: string, viewerId: string) {
    return db
      .select(answerColumns(viewerId))
      .from(answers)
      .innerJoin(users, eq(users.id, answers.authorId))
      .innerJoin(questions, eq(questions.id, answers.questionId))
      .where(eq(answers.questionId, questionId))
      .orderBy(
        desc(answers.isAccepted),
        desc(sql`${users.role} = 'TEACHER'`),
        desc(usefulCountSql),
        asc(answers.createdAt),
      );
  },

  async findPublicById(db: Database, id: string, viewerId: string) {
    const [row] = await db
      .select(answerColumns(viewerId))
      .from(answers)
      .innerJoin(users, eq(users.id, answers.authorId))
      .innerJoin(questions, eq(questions.id, answers.questionId))
      .where(eq(answers.id, id));
    return row;
  },

  async findInternalById(db: Database, id: string) {
    const [row] = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        authorId: answers.authorId,
        authorRole: users.role,
        isAccepted: answers.isAccepted,
        content: answers.content,
      })
      .from(answers)
      .innerJoin(users, eq(users.id, answers.authorId))
      .where(eq(answers.id, id));
    return row;
  },

  async insert(db: Database, values: { questionId: string; authorId: string; content: string }) {
    const [row] = await db.insert(answers).values(values).returning({ id: answers.id });
    return row!;
  },

  async updateContent(db: Database, id: string, content: string) {
    await db.update(answers).set({ content }).where(eq(answers.id, id));
  },

  async delete(db: Database, id: string) {
    await db.delete(answers).where(eq(answers.id, id));
  },

  async accept(db: Database, questionId: string, answerId: string) {
    await db
      .update(answers)
      .set({ isAccepted: false })
      .where(
        and(
          eq(answers.questionId, questionId),
          ne(answers.id, answerId),
          eq(answers.isAccepted, true),
        ),
      );
    await db.update(answers).set({ isAccepted: true }).where(eq(answers.id, answerId));
  },

  async addVote(db: Database, answerId: string, userId: string) {
    await db.insert(answerVotes).values({ answerId, userId }).onConflictDoNothing();
  },

  async removeVote(db: Database, answerId: string, userId: string) {
    await db
      .delete(answerVotes)
      .where(and(eq(answerVotes.answerId, answerId), eq(answerVotes.userId, userId)));
  },
};

export const commentRepository = {
  async listPublicForQuestion(db: Database, questionId: string, viewerId: string) {
    return db
      .select(commentColumns(viewerId))
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .innerJoin(questions, eq(questions.id, comments.questionId))
      .where(eq(comments.questionId, questionId))
      .orderBy(asc(comments.createdAt));
  },

  async findPublicById(db: Database, id: string, viewerId: string) {
    const [row] = await db
      .select(commentColumns(viewerId))
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .innerJoin(questions, eq(questions.id, comments.questionId))
      .where(eq(comments.id, id));
    return row;
  },

  async findInternalById(db: Database, id: string) {
    const [row] = await db
      .select({
        id: comments.id,
        questionId: comments.questionId,
        authorId: comments.authorId,
        content: comments.content,
      })
      .from(comments)
      .where(eq(comments.id, id));
    return row;
  },

  async insert(db: Database, values: { questionId: string; authorId: string; content: string }) {
    const [row] = await db.insert(comments).values(values).returning({ id: comments.id });
    return row!;
  },

  async delete(db: Database, id: string) {
    await db.delete(comments).where(eq(comments.id, id));
  },
};

export type PublicAnswerRecord = NonNullable<
  Awaited<ReturnType<typeof answerRepository.findPublicById>>
>;
export type PublicCommentRecord = NonNullable<
  Awaited<ReturnType<typeof commentRepository.findPublicById>>
>;
