import { and, count, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { answers, comments, questions, reports, subjects, users } from '../db/schema.js';
import type { AuthUser } from '../types/express.js';
import { questionRepository } from '../repositories/question.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { toAdminUserDto, toModerationQuestionDto } from '../serializers/index.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  ModerateQuestionInput,
  ModerationQueueQuery,
  UpdateUserInput,
} from '../validators/admin.validators.js';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { paginate } from '../utils/pagination.js';
import { hashPassword } from '../utils/password.js';
import { truncate } from '../utils/text.js';
import type { NotificationService } from './notification.service.js';

export class AdminService {
  constructor(
    private readonly db: Database,
    private readonly notifications: NotificationService,
  ) {}

  async listUsers(query: ListUsersQuery) {
    const { page, pageSize, ...filters } = query;
    const { rows, total } = await userRepository.listForAdmin(this.db, filters, { page, pageSize });
    return paginate(
      rows.map((u) => toAdminUserDto(u)),
      total,
      { page, pageSize },
    );
  }

  async getUser(id: string) {
    const user = await userRepository.findForAdmin(this.db, id);
    if (!user) throw new NotFoundError('User');
    const assigned =
      user.role === 'TEACHER' ? await userRepository.listTeacherSubjects(this.db, id) : undefined;
    return toAdminUserDto(user, assigned);
  }

  private async assertSubjectsExist(db: Database, subjectIds: string[]) {
    const unique = [...new Set(subjectIds)];
    if (!unique.length) return unique;
    const found = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(inArray(subjects.id, unique));
    if (found.length !== unique.length) {
      throw new ValidationError([
        { path: 'subjectIds', message: 'One or more subjects do not exist' },
      ]);
    }
    return unique;
  }

  async createUser(input: CreateUserInput) {
    if (await userRepository.existsByEmail(this.db, input.email)) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
    }
    if (input.rollNumber && (await userRepository.existsByRollNumber(this.db, input.rollNumber))) {
      throw new ConflictError('This roll number is already registered', 'ROLL_NUMBER_TAKEN');
    }
    if (input.subjectIds?.length && input.role !== 'TEACHER') {
      throw new ValidationError([
        { path: 'subjectIds', message: 'Only teachers can be assigned subjects' },
      ]);
    }

    const passwordHash = await hashPassword(input.password);
    const id = await this.db.transaction(async (tx) => {
      const created = await userRepository.create(tx, {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        department: input.department,
        academicYear: input.role === 'STUDENT' ? (input.academicYear ?? null) : null,
        rollNumber: input.rollNumber ?? null,
      });
      if (input.subjectIds?.length) {
        const ids = await this.assertSubjectsExist(tx, input.subjectIds);
        await userRepository.replaceTeacherSubjects(tx, created.id, ids);
      }
      return created.id;
    });
    return this.getUser(id);
  }

  async updateUser(admin: AuthUser, id: string, input: UpdateUserInput) {
    const user = await userRepository.findForAdmin(this.db, id);
    if (!user) throw new NotFoundError('User');

    if (id === admin.id && (input.role !== undefined || input.isActive === false)) {
      throw new BadRequestError('You cannot change your own role or suspend your own account');
    }
    const losingAdmin =
      user.role === 'ADMIN' &&
      user.isActive &&
      (input.isActive === false || (input.role && input.role !== 'ADMIN'));
    if (losingAdmin && (await userRepository.countActiveAdmins(this.db)) <= 1) {
      throw new ConflictError('At least one active administrator is required', 'LAST_ADMIN');
    }

    await this.db.transaction(async (tx) => {
      await userRepository.update(tx, id, {
        ...input,
        ...(input.role && input.role !== 'STUDENT' ? { academicYear: null } : {}),
      });
      const privilegeChanged =
        (input.role !== undefined && input.role !== user.role) ||
        (input.isActive !== undefined && input.isActive !== user.isActive);
      if (privilegeChanged) await userRepository.bumpTokenVersion(tx, id);
      if (input.role && input.role !== 'TEACHER')
        await userRepository.replaceTeacherSubjects(tx, id, []);
    });
    return this.getUser(id);
  }

  async setTeacherSubjects(id: string, subjectIds: string[]) {
    const user = await userRepository.findForAdmin(this.db, id);
    if (!user) throw new NotFoundError('User');
    if (user.role !== 'TEACHER')
      throw new BadRequestError('Subjects can only be assigned to teachers');
    await this.db.transaction(async (tx) => {
      const ids = await this.assertSubjectsExist(tx, subjectIds);
      await userRepository.replaceTeacherSubjects(tx, id, ids);
    });
    return this.getUser(id);
  }

  async moderationQueue(query: ModerationQueueQuery) {
    const { page, pageSize, ...filters } = query;
    const { rows, total } = await questionRepository.listForModeration(this.db, filters, {
      page,
      pageSize,
    });
    return paginate(rows.map(toModerationQuestionDto), total, { page, pageSize });
  }

  async moderateQuestion(admin: AuthUser, id: string, input: ModerateQuestionInput) {
    const question = await questionRepository.findInternalById(this.db, id);
    if (!question) throw new NotFoundError('Question');

    await this.db.transaction(async (tx) => {
      const closeOpenReports = () =>
        tx
          .update(reports)
          .set({
            status: 'RESOLVED',
            resolvedById: admin.id,
            resolvedAt: new Date(),
            resolutionNote: input.note || `Question ${input.action.toLowerCase()}d by a moderator`,
          })
          .where(and(eq(reports.questionId, id), eq(reports.status, 'OPEN')));

      const title = truncate(question.title, 120);
      const notifyAuthor = (heading: string, message: string, linkQuestion = true) =>
        this.notifications.notify(tx, {
          userId: question.authorId,
          type: 'QUESTION_MODERATED',
          title: heading,
          message: input.note ? `${message} Moderator note: ${input.note}` : message,
          questionId: linkQuestion ? id : null,
        });

      switch (input.action) {
        case 'FLAG':
          await questionRepository.update(tx, id, {
            status: 'FLAGGED',
            moderationNote: input.note || 'Hidden by a moderator.',
          });
          await closeOpenReports();
          await notifyAuthor(
            'Your question was hidden by a moderator',
            `"${title}" is no longer publicly visible.`,
          );
          break;
        case 'RESTORE':
          await questionRepository.update(tx, id, {
            status: await questionRepository.resolveActiveStatus(tx, id),
            moderationNote: null,
          });
          await tx
            .update(reports)
            .set({
              status: 'DISMISSED',
              resolvedById: admin.id,
              resolvedAt: new Date(),
              resolutionNote: input.note || 'Restored by a moderator',
            })
            .where(and(eq(reports.questionId, id), eq(reports.status, 'OPEN')));
          if (question.status === 'FLAGGED') {
            await notifyAuthor('Your question was restored', `"${title}" is visible again.`);
          }
          break;
        case 'CLOSE':
          await questionRepository.update(tx, id, {
            status: 'CLOSED',
            moderationNote: input.note || null,
          });
          await notifyAuthor('Your question was closed', `"${title}" was closed by a moderator.`);
          break;
        case 'DELETE':
          await closeOpenReports();
          await notifyAuthor(
            'Your question was removed',
            `"${title}" was removed by a moderator.`,
            false,
          );
          await questionRepository.delete(tx, id);
          break;
      }

      if (input.suspendAuthor) {
        await userRepository.update(tx, question.authorId, { isActive: false });
        await userRepository.bumpTokenVersion(tx, question.authorId);
      }
    });

    return { id, action: input.action, authorSuspended: input.suspendAuthor };
  }

  async statistics() {
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    const [
      usersByRole,
      questionsByStatus,
      [answerTotals],
      [commentTotal],
      [openReports],
      perSubject,
      daily,
      [responseTime],
      [aiClassified],
    ] = await Promise.all([
      this.db
        .select({
          role: users.role,
          value: count(),
          active: sql<number>`count(*) FILTER (WHERE ${users.isActive})::int`,
        })
        .from(users)
        .groupBy(users.role),
      this.db
        .select({ status: questions.status, value: count() })
        .from(questions)
        .groupBy(questions.status),
      this.db
        .select({
          value: count(),
          accepted: sql<number>`count(*) FILTER (WHERE ${answers.isAccepted})::int`,
        })
        .from(answers),
      this.db.select({ value: count() }).from(comments),
      this.db.select({ value: count() }).from(reports).where(eq(reports.status, 'OPEN')),
      this.db
        .select({
          subjectId: subjects.id,
          name: subjects.name,
          code: subjects.code,
          questions: sql<number>`count(${questions.id})::int`,
          answered: sql<number>`count(*) FILTER (WHERE ${questions.status} = 'ANSWERED')::int`,
        })
        .from(subjects)
        .leftJoin(questions, eq(questions.subjectId, subjects.id))
        .groupBy(subjects.id, subjects.name, subjects.code)
        .orderBy(sql`count(${questions.id}) DESC`, subjects.name),
      this.db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${questions.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
          value: count(),
        })
        .from(questions)
        .where(gte(questions.createdAt, since))
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      this.db
        .execute<{ median_hours: number | null }>(
          sql`
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM first_answer - q.created_at) / 3600.0) AS median_hours
        FROM ${questions} q
        JOIN LATERAL (SELECT min(a.created_at) AS first_answer FROM ${answers} a WHERE a.question_id = q.id) fa ON fa.first_answer IS NOT NULL
      `,
        )
        .then((r) => (r as unknown as { rows: { median_hours: number | null }[] }).rows),
      this.db.select({ value: count() }).from(questions).where(isNotNull(questions.aiCategory)),
    ]);

    const roleCount = (role: string) => usersByRole.find((r) => r.role === role)?.value ?? 0;
    const statusCount = (status: string) =>
      questionsByStatus.find((r) => r.status === status)?.value ?? 0;
    const totalQuestions = questionsByStatus.reduce((sum, r) => sum + r.value, 0);

    const dailyMap = new Map(daily.map((d) => [d.day, d.value]));
    const questionsPerDay = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(since.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return { date, count: dailyMap.get(date) ?? 0 };
    });

    const medianHours = responseTime?.median_hours;
    return {
      users: {
        total: usersByRole.reduce((sum, r) => sum + r.value, 0),
        students: roleCount('STUDENT'),
        teachers: roleCount('TEACHER'),
        admins: roleCount('ADMIN'),
        suspended: usersByRole.reduce((sum, r) => sum + (r.value - Number(r.active)), 0),
      },
      questions: {
        total: totalQuestions,
        open: statusCount('OPEN'),
        answered: statusCount('ANSWERED'),
        closed: statusCount('CLOSED'),
        flagged: statusCount('FLAGGED'),
        aiClassified: aiClassified?.value ?? 0,
      },
      answers: { total: answerTotals?.value ?? 0, accepted: Number(answerTotals?.accepted ?? 0) },
      comments: { total: commentTotal?.value ?? 0 },
      reports: { open: openReports?.value ?? 0 },
      answerRate: totalQuestions ? Math.round((statusCount('ANSWERED') / totalQuestions) * 100) : 0,
      medianFirstResponseHours:
        medianHours === null || medianHours === undefined
          ? null
          : Math.round(Number(medianHours) * 10) / 10,
      questionsPerSubject: perSubject.map((s) => ({
        subjectId: s.subjectId,
        name: s.name,
        code: s.code,
        questions: Number(s.questions),
        answered: Number(s.answered),
      })),
      questionsPerDay,
    };
  }
}
