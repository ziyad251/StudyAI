import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Database } from '../db/client.js';
import {
  aiExplanations,
  answers,
  comments,
  questions,
  reports,
  subjects,
  users,
  type QuestionStatus,
} from '../db/schema.js';
import { escapeLike } from '../utils/text.js';
import { toOffset, type PageParams } from '../utils/pagination.js';

const answerCountSql = sql<number>`(SELECT count(*) FROM ${answers} WHERE ${answers.questionId} = ${questions.id})::int`;
const commentCountSql = sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.questionId} = ${questions.id})::int`;
const hasTeacherAnswerSql = sql<boolean>`EXISTS (
  SELECT 1 FROM ${answers} INNER JOIN ${users} ON ${users.id} = ${answers.authorId}
  WHERE ${answers.questionId} = ${questions.id} AND ${users.role} = 'TEACHER'
)`;
const hasAcceptedAnswerSql = sql<boolean>`EXISTS (
  SELECT 1 FROM ${answers} WHERE ${answers.questionId} = ${questions.id} AND ${answers.isAccepted} = true
)`;
const openReportCountSql = sql<number>`(
  SELECT count(*) FROM ${reports} WHERE ${reports.questionId} = ${questions.id} AND ${reports.status} = 'OPEN'
)::int`;
const searchVectorSql = sql`to_tsvector('english', ${questions.title} || ' ' || ${questions.description})`;

function isOwnSql(viewerId: string | null) {
  return viewerId ? sql<boolean>`(${questions.authorId} = ${viewerId})` : sql<boolean>`false`;
}

function publicColumns(viewerId: string | null) {
  return {
    id: questions.id,
    title: questions.title,
    description: questions.description,
    status: questions.status,
    aiCategory: questions.aiCategory,
    aiConfidence: questions.aiConfidence,
    createdAt: questions.createdAt,
    updatedAt: questions.updatedAt,
    subjectId: subjects.id,
    subjectName: subjects.name,
    subjectCode: subjects.code,
    subjectCategory: subjects.category,
    answerCount: answerCountSql,
    commentCount: commentCountSql,
    hasTeacherAnswer: hasTeacherAnswerSql,
    hasAcceptedAnswer: hasAcceptedAnswerSql,
    isOwn: isOwnSql(viewerId),
  };
}

export interface QuestionViewer {
  id: string | null;
  canSeeFlagged: boolean;
}

export interface QuestionFilters {
  search?: string;
  subjectId?: string;
  subjectIds?: string[];
  status?: QuestionStatus;
  excludeStatuses?: QuestionStatus[];
  mine?: boolean;
  unanswered?: boolean;
  reportedOnly?: boolean;
  sort?: 'newest' | 'oldest' | 'most_answered';
}

function visibilityCondition(viewer: QuestionViewer): SQL | undefined {
  if (viewer.canSeeFlagged) return undefined;
  if (!viewer.id) return ne(questions.status, 'FLAGGED');
  return or(ne(questions.status, 'FLAGGED'), eq(questions.authorId, viewer.id));
}

function buildConditions(filters: QuestionFilters, viewer: QuestionViewer): SQL | undefined {
  const conditions: (SQL | undefined)[] = [visibilityCondition(viewer)];

  if (filters.status) conditions.push(eq(questions.status, filters.status));
  if (filters.excludeStatuses?.length) {
    conditions.push(notInArray(questions.status, filters.excludeStatuses));
  }
  if (filters.subjectId) conditions.push(eq(questions.subjectId, filters.subjectId));
  if (filters.subjectIds) {
    conditions.push(
      filters.subjectIds.length ? inArray(questions.subjectId, filters.subjectIds) : sql`false`,
    );
  }
  if (filters.mine) {
    conditions.push(viewer.id ? eq(questions.authorId, viewer.id) : sql`false`);
  }
  if (filters.unanswered) conditions.push(sql`${answerCountSql} = 0`);
  if (filters.reportedOnly) conditions.push(sql`${openReportCountSql} > 0`);
  if (filters.search) {
    conditions.push(
      or(
        sql`${searchVectorSql} @@ websearch_to_tsquery('english', ${filters.search})`,
        ilike(questions.title, `%${escapeLike(filters.search)}%`),
      ),
    );
  }
  const defined = conditions.filter((c): c is SQL => c !== undefined);
  return defined.length ? and(...defined) : undefined;
}

function orderBy(sort: QuestionFilters['sort']) {
  switch (sort) {
    case 'oldest':
      return [asc(questions.createdAt)];
    case 'most_answered':
      return [desc(answerCountSql), desc(questions.createdAt)];
    default:
      return [desc(questions.createdAt)];
  }
}

export const questionRepository = {
  async listPublic(
    db: Database,
    filters: QuestionFilters,
    viewer: QuestionViewer,
    page: PageParams,
  ) {
    const where = buildConditions(filters, viewer);
    const [rows, [total]] = await Promise.all([
      db
        .select(publicColumns(viewer.id))
        .from(questions)
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(where)
        .orderBy(...orderBy(filters.sort))
        .limit(page.pageSize)
        .offset(toOffset(page)),
      db
        .select({ value: count() })
        .from(questions)
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(where),
    ]);
    return { rows, total: total?.value ?? 0 };
  },

  async findPublicById(db: Database, id: string, viewer: QuestionViewer) {
    const [row] = await db
      .select(publicColumns(viewer.id))
      .from(questions)
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(and(eq(questions.id, id), visibilityCondition(viewer)));
    return row;
  },

  async listForModeration(db: Database, filters: QuestionFilters, page: PageParams) {
    const viewer: QuestionViewer = { id: null, canSeeFlagged: true };
    const where = buildConditions(filters, viewer);
    const [rows, [total]] = await Promise.all([
      db
        .select({
          ...publicColumns(null),
          moderationNote: questions.moderationNote,
          openReportCount: openReportCountSql,
        })
        .from(questions)
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(where)
        .orderBy(desc(openReportCountSql), desc(questions.createdAt))
        .limit(page.pageSize)
        .offset(toOffset(page)),
      db
        .select({ value: count() })
        .from(questions)
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(where),
    ]);
    return { rows, total: total?.value ?? 0 };
  },

  async findInternalById(db: Database, id: string) {
    const [row] = await db
      .select({
        id: questions.id,
        authorId: questions.authorId,
        subjectId: questions.subjectId,
        status: questions.status,
        title: questions.title,
        description: questions.description,
      })
      .from(questions)
      .where(eq(questions.id, id));
    return row;
  },

  async insert(
    db: Database,
    values: {
      authorId: string;
      subjectId: string;
      title: string;
      description: string;
      aiCategory?: string | null;
      aiConfidence?: number | null;
      aiSubjectId?: string | null;
    },
  ) {
    const [row] = await db.insert(questions).values(values).returning({ id: questions.id });
    return row!;
  },

  async update(
    db: Database,
    id: string,
    values: Partial<{
      title: string;
      description: string;
      subjectId: string;
      status: QuestionStatus;
      moderationNote: string | null;
      aiCategory: string | null;
      aiConfidence: number | null;
      aiSubjectId: string | null;
    }>,
  ) {
    await db.update(questions).set(values).where(eq(questions.id, id));
  },

  async delete(db: Database, id: string) {
    await db.delete(questions).where(eq(questions.id, id));
  },

  async countAnswers(db: Database, questionId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(answers)
      .where(eq(answers.questionId, questionId));
    return row?.value ?? 0;
  },

  async refreshAnsweredStatus(db: Database, questionId: string) {
    await db
      .update(questions)
      .set({
        status: sql`CASE WHEN ${hasTeacherAnswerSql} OR ${hasAcceptedAnswerSql} THEN 'ANSWERED'::question_status ELSE 'OPEN'::question_status END`,
      })
      .where(and(eq(questions.id, questionId), inArray(questions.status, ['OPEN', 'ANSWERED'])));
  },

  async resolveActiveStatus(db: Database, questionId: string): Promise<'OPEN' | 'ANSWERED'> {
    const [row] = await db
      .select({ answered: sql<boolean>`${hasTeacherAnswerSql} OR ${hasAcceptedAnswerSql}` })
      .from(questions)
      .where(eq(questions.id, questionId));
    return row?.answered ? 'ANSWERED' : 'OPEN';
  },

  async findCachedExplanation(db: Database, questionId: string) {
    const [row] = await db
      .select()
      .from(aiExplanations)
      .where(eq(aiExplanations.questionId, questionId));
    return row;
  },

  async saveExplanation(
    db: Database,
    values: { questionId: string; content: string; model: string },
  ) {
    const [row] = await db
      .insert(aiExplanations)
      .values(values)
      .onConflictDoUpdate({
        target: aiExplanations.questionId,
        set: { content: values.content, model: values.model, createdAt: new Date() },
      })
      .returning();
    return row!;
  },

  async clearExplanation(db: Database, questionId: string) {
    await db.delete(aiExplanations).where(eq(aiExplanations.questionId, questionId));
  },
};

export type PublicQuestionRecord = Awaited<
  ReturnType<typeof questionRepository.listPublic>
>['rows'][number];
export type ModerationQuestionRecord = Awaited<
  ReturnType<typeof questionRepository.listForModeration>
>['rows'][number];
