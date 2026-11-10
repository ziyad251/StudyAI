import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { answers, questions, subjects, teacherSubjects } from '../db/schema.js';
import type { AuthUser } from '../types/express.js';
import { questionRepository } from '../repositories/question.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { toPublicQuestionDto } from '../serializers/index.js';
import { ValidationError } from '../utils/errors.js';
import { paginate } from '../utils/pagination.js';
import type { z } from 'zod';
import type { teacherQuestionsQuerySchema } from '../validators/misc.validators.js';

type TeacherQuestionsQuery = z.infer<typeof teacherQuestionsQuerySchema>;

export class TeacherService {
  constructor(private readonly db: Database) {}

  async subjects(teacherId: string) {
    return userRepository.listTeacherSubjects(this.db, teacherId);
  }

  private async subjectIds(teacherId: string) {
    const rows = await this.db
      .select({ id: teacherSubjects.subjectId })
      .from(teacherSubjects)
      .where(eq(teacherSubjects.teacherId, teacherId));
    return rows.map((r) => r.id);
  }

  async questions(teacher: AuthUser, query: TeacherQuestionsQuery) {
    const assigned = await this.subjectIds(teacher.id);
    if (query.subjectId && !assigned.includes(query.subjectId)) {
      throw new ValidationError([
        { path: 'subjectId', message: 'This subject is not assigned to you' },
      ]);
    }
    const { page, pageSize, subjectId, ...filters } = query;
    const { rows, total } = await questionRepository.listPublic(
      this.db,
      { ...filters, subjectIds: subjectId ? [subjectId] : assigned, excludeStatuses: ['FLAGGED'] },
      { id: teacher.id, canSeeFlagged: false },
      { page, pageSize },
    );
    return paginate(rows.map(toPublicQuestionDto), total, { page, pageSize });
  }

  async answers(teacherId: string, page: { page: number; pageSize: number }) {
    const where = eq(answers.authorId, teacherId);
    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: answers.id,
          content: answers.content,
          isAccepted: answers.isAccepted,
          createdAt: answers.createdAt,
          updatedAt: answers.updatedAt,
          usefulCount: sql<number>`(SELECT count(*) FROM answer_votes v WHERE v.answer_id = ${answers.id})::int`,
          questionId: questions.id,
          questionTitle: questions.title,
          questionStatus: questions.status,
          subjectName: subjects.name,
        })
        .from(answers)
        .innerJoin(questions, eq(questions.id, answers.questionId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(and(where, sql`${questions.status} <> 'FLAGGED'`))
        .orderBy(desc(answers.createdAt))
        .limit(page.pageSize)
        .offset((page.page - 1) * page.pageSize),
      this.db
        .select({ value: count() })
        .from(answers)
        .innerJoin(questions, eq(questions.id, answers.questionId))
        .where(and(where, sql`${questions.status} <> 'FLAGGED'`)),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      content: r.content,
      isAccepted: r.isAccepted,
      usefulCount: Number(r.usefulCount),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      question: {
        id: r.questionId,
        title: r.questionTitle,
        status: r.questionStatus,
        subject: r.subjectName,
      },
    }));
    return paginate(items, total?.value ?? 0, page);
  }

  async statistics(teacherId: string) {
    const assigned = await this.subjectIds(teacherId);

    const perSubject = assigned.length
      ? await this.db
          .select({
            subjectId: subjects.id,
            name: subjects.name,
            code: subjects.code,
            total: sql<number>`count(${questions.id})::int`,
            open: sql<number>`count(*) FILTER (WHERE ${questions.status} = 'OPEN')::int`,
            answered: sql<number>`count(*) FILTER (WHERE ${questions.status} = 'ANSWERED')::int`,
            closed: sql<number>`count(*) FILTER (WHERE ${questions.status} = 'CLOSED')::int`,
            unanswered: sql<number>`count(*) FILTER (WHERE ${questions.status} IN ('OPEN') AND NOT EXISTS (SELECT 1 FROM ${answers} WHERE ${answers.questionId} = ${questions.id}))::int`,
          })
          .from(subjects)
          .leftJoin(
            questions,
            and(eq(questions.subjectId, subjects.id), sql`${questions.status} <> 'FLAGGED'`),
          )
          .where(inArray(subjects.id, assigned))
          .groupBy(subjects.id, subjects.name, subjects.code)
          .orderBy(subjects.name)
      : [];

    const [mine] = await this.db
      .select({
        answers: count(),
        accepted: sql<number>`count(*) FILTER (WHERE ${answers.isAccepted})::int`,
      })
      .from(answers)
      .where(eq(answers.authorId, teacherId));

    const sum = (key: 'total' | 'open' | 'answered' | 'unanswered') =>
      perSubject.reduce((acc, s) => acc + Number(s[key]), 0);

    return {
      assignedSubjects: perSubject.length,
      totalQuestions: sum('total'),
      openQuestions: sum('open'),
      answeredQuestions: sum('answered'),
      unansweredQuestions: sum('unanswered'),
      myAnswers: mine?.answers ?? 0,
      myAcceptedAnswers: Number(mine?.accepted ?? 0),
      perSubject: perSubject.map((s) => ({
        subjectId: s.subjectId,
        name: s.name,
        code: s.code,
        total: Number(s.total),
        open: Number(s.open),
        answered: Number(s.answered),
        closed: Number(s.closed),
        unanswered: Number(s.unanswered),
      })),
    };
  }
}
