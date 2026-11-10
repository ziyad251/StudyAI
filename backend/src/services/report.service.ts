import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import { answers, comments, questions, reports } from '../db/schema.js';
import type { AuthUser } from '../types/express.js';
import { answerRepository, commentRepository } from '../repositories/answer.repository.js';
import { questionRepository } from '../repositories/question.repository.js';
import type {
  CreateReportInput,
  ListReportsQuery,
  ResolveReportInput,
} from '../validators/report.validators.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import { paginate, toOffset } from '../utils/pagination.js';
import { truncate } from '../utils/text.js';
import type { NotificationService } from './notification.service.js';
import { loadVisibleQuestion } from './question-access.js';

interface ResolvedTarget {
  questionId: string;
  authorId: string;
  snapshot: string;
  columns: { questionId?: string; answerId?: string; commentId?: string };
}

export class ReportService {
  constructor(
    private readonly db: Database,
    private readonly config: AppConfig,
    private readonly notifications: NotificationService,
  ) {}

  private async resolveTarget(user: AuthUser, input: CreateReportInput): Promise<ResolvedTarget> {
    switch (input.targetType) {
      case 'QUESTION': {
        const q = await loadVisibleQuestion(this.db, input.targetId, user);
        return {
          questionId: q.id,
          authorId: q.authorId,
          snapshot: `${q.title}\n\n${q.description}`,
          columns: { questionId: q.id },
        };
      }
      case 'ANSWER': {
        const a = await answerRepository.findInternalById(this.db, input.targetId);
        if (!a) throw new NotFoundError('Answer');
        await loadVisibleQuestion(this.db, a.questionId, user);
        return {
          questionId: a.questionId,
          authorId: a.authorId,
          snapshot: a.content,
          columns: { answerId: a.id },
        };
      }
      case 'COMMENT': {
        const c = await commentRepository.findInternalById(this.db, input.targetId);
        if (!c) throw new NotFoundError('Comment');
        await loadVisibleQuestion(this.db, c.questionId, user);
        return {
          questionId: c.questionId,
          authorId: c.authorId,
          snapshot: c.content,
          columns: { commentId: c.id },
        };
      }
    }
  }

  async create(user: AuthUser, input: CreateReportInput) {
    const target = await this.resolveTarget(user, input);
    if (target.authorId === user.id)
      throw new BadRequestError('You cannot report your own content');

    const result = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(reports)
        .values({
          reporterId: user.id,
          targetType: input.targetType,
          ...target.columns,
          contextQuestionId: target.questionId,
          contentSnapshot: truncate(target.snapshot, 2000),
          reason: input.reason,
          details: input.details || null,
        })
        .onConflictDoNothing()
        .returning({ id: reports.id });
      if (!created)
        throw new ConflictError('You have already reported this content', 'ALREADY_REPORTED');

      let autoFlagged = false;
      if (input.targetType === 'QUESTION') {
        const [open] = await tx
          .select({ value: count() })
          .from(reports)
          .where(and(eq(reports.questionId, target.questionId), eq(reports.status, 'OPEN')));
        const question = await questionRepository.findInternalById(tx, target.questionId);
        if (
          question &&
          question.status !== 'FLAGGED' &&
          (open?.value ?? 0) >= this.config.autoFlagReportThreshold
        ) {
          await questionRepository.update(tx, question.id, {
            status: 'FLAGGED',
            moderationNote:
              'Automatically hidden after multiple reports, pending moderator review.',
          });
          await this.notifications.notify(tx, {
            userId: question.authorId,
            type: 'QUESTION_MODERATED',
            title: 'Your question is under review',
            message: `"${truncate(question.title, 120)}" was reported by several users and is hidden until a moderator reviews it.`,
            questionId: question.id,
          });
          autoFlagged = true;
        }
      }
      return { id: created.id, autoFlagged };
    });

    return {
      id: result.id,
      status: 'OPEN' as const,
      message: 'Thank you. A moderator will review this report.',
    };
  }

  async list(query: ListReportsQuery) {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(reports.status, query.status));
    if (query.targetType) conditions.push(eq(reports.targetType, query.targetType));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: reports.id,
          targetType: reports.targetType,
          questionId: reports.questionId,
          answerId: reports.answerId,
          commentId: reports.commentId,
          contextQuestionId: reports.contextQuestionId,
          contextQuestionTitle: questions.title,
          contextQuestionStatus: questions.status,
          contentSnapshot: reports.contentSnapshot,
          reason: reports.reason,
          details: reports.details,
          status: reports.status,
          resolutionNote: reports.resolutionNote,
          resolvedAt: reports.resolvedAt,
          createdAt: reports.createdAt,
          sameTargetOpenCount: sql<number>`(
            SELECT count(*) FROM ${reports} r2
            WHERE r2.status = 'OPEN' AND r2.target_type = ${reports.targetType}
              AND (r2.question_id = ${reports.questionId} OR r2.answer_id = ${reports.answerId} OR r2.comment_id = ${reports.commentId})
          )::int`,
        })
        .from(reports)
        .leftJoin(questions, eq(questions.id, reports.contextQuestionId))
        .where(where)
        .orderBy(
          sql`CASE WHEN ${reports.status} = 'OPEN' THEN 0 ELSE 1 END`,
          desc(reports.createdAt),
        )
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ value: count() }).from(reports).where(where),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.questionId ?? r.answerId ?? r.commentId,
      targetRemoved: !(r.questionId ?? r.answerId ?? r.commentId),
      question: r.contextQuestionId
        ? {
            id: r.contextQuestionId,
            title: r.contextQuestionTitle,
            status: r.contextQuestionStatus,
          }
        : null,
      contentSnapshot: r.contentSnapshot,
      reason: r.reason,
      details: r.details,
      status: r.status,
      reportCount: Number(r.sameTargetOpenCount),
      resolutionNote: r.resolutionNote,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    return paginate(items, total?.value ?? 0, query);
  }

  async resolve(admin: AuthUser, reportId: string, input: ResolveReportInput) {
    const [report] = await this.db.select().from(reports).where(eq(reports.id, reportId));
    if (!report) throw new NotFoundError('Report');
    if (report.status !== 'OPEN')
      throw new ConflictError('This report has already been handled', 'REPORT_CLOSED');

    await this.db.transaction(async (tx) => {
      const resolution = {
        status: input.status,
        resolutionNote: input.resolutionNote || null,
        resolvedById: admin.id,
        resolvedAt: new Date(),
      };

      const sameTarget = report.questionId
        ? eq(reports.questionId, report.questionId)
        : report.answerId
          ? eq(reports.answerId, report.answerId)
          : report.commentId
            ? eq(reports.commentId, report.commentId)
            : eq(reports.id, report.id);
      const affected = await tx
        .update(reports)
        .set(resolution)
        .where(and(sameTarget, eq(reports.status, 'OPEN')))
        .returning({ reporterId: reports.reporterId });

      if (input.status === 'RESOLVED' && input.removeContent) {
        await this.removeContent(tx, report, input.resolutionNote);
      }

      await this.notifications.notify(
        tx,
        affected.map((r) => ({
          userId: r.reporterId,
          type: 'REPORT_RESOLVED' as const,
          title: 'Your report was reviewed',
          message:
            input.status === 'RESOLVED'
              ? 'Thanks for your report. A moderator reviewed it and took action.'
              : 'Thanks for your report. A moderator reviewed it and found no violation.',
          questionId: report.contextQuestionId,
        })),
      );
    });

    const [updated] = await this.db
      .select({ id: reports.id, status: reports.status, resolvedAt: reports.resolvedAt })
      .from(reports)
      .where(eq(reports.id, reportId));
    return {
      id: updated!.id,
      status: updated!.status,
      resolvedAt: updated!.resolvedAt?.toISOString() ?? null,
    };
  }

  private async removeContent(tx: Database, report: typeof reports.$inferSelect, note?: string) {
    if (report.questionId) {
      const question = await questionRepository.findInternalById(tx, report.questionId);
      if (question && question.status !== 'FLAGGED') {
        await questionRepository.update(tx, question.id, {
          status: 'FLAGGED',
          moderationNote: note || 'Hidden by a moderator after review.',
        });
        await this.notifications.notify(tx, {
          userId: question.authorId,
          type: 'QUESTION_MODERATED',
          title: 'Your question was hidden by a moderator',
          message: `"${truncate(question.title, 120)}" was hidden for violating community guidelines.${note ? ` Note: ${note}` : ''}`,
          questionId: question.id,
        });
      }
    } else if (report.answerId) {
      const [answer] = await tx
        .select({ questionId: answers.questionId })
        .from(answers)
        .where(eq(answers.id, report.answerId));
      await tx.delete(answers).where(eq(answers.id, report.answerId));
      if (answer) await questionRepository.refreshAnsweredStatus(tx, answer.questionId);
    } else if (report.commentId) {
      await tx.delete(comments).where(eq(comments.id, report.commentId));
    }
  }
}
