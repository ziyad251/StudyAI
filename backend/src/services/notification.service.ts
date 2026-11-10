import { and, count, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { notifications, teacherSubjects, users, type NotificationType } from '../db/schema.js';
import { toNotificationDto } from '../serializers/index.js';
import { NotFoundError } from '../utils/errors.js';
import { paginate, toOffset, type PageParams } from '../utils/pagination.js';
import { truncate } from '../utils/text.js';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  questionId?: string | null;
}

export class NotificationService {
  constructor(private readonly db: Database) {}

  async notify(db: Database, items: NewNotification | NewNotification[]) {
    const list = (Array.isArray(items) ? items : [items]).map((n) => ({
      ...n,
      title: truncate(n.title, 200),
    }));
    if (list.length === 0) return;
    await db.insert(notifications).values(list);
  }

  async notifySubjectTeachers(
    db: Database,
    subjectId: string,
    question: { id: string; title: string },
  ) {
    const teachers = await db
      .select({ id: users.id })
      .from(teacherSubjects)
      .innerJoin(users, eq(users.id, teacherSubjects.teacherId))
      .where(
        and(
          eq(teacherSubjects.subjectId, subjectId),
          eq(users.isActive, true),
          eq(users.role, 'TEACHER'),
        ),
      );

    await this.notify(
      db,
      teachers.map((t) => ({
        userId: t.id,
        type: 'NEW_QUESTION_IN_SUBJECT' as const,
        title: 'New question in your subject',
        message: `A student asked: "${truncate(question.title, 120)}"`,
        questionId: question.id,
      })),
    );
  }

  async list(userId: string, options: { unreadOnly?: boolean }, page: PageParams) {
    const where = options.unreadOnly
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : eq(notifications.userId, userId);

    const [rows, [total], unreadCount] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(page.pageSize)
        .offset(toOffset(page)),
      this.db.select({ value: count() }).from(notifications).where(where),
      this.unreadCount(userId),
    ]);
    return { ...paginate(rows.map(toNotificationDto), total?.value ?? 0, page), unreadCount };
  }

  async unreadCount(userId: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return row?.value ?? 0;
  }

  async markRead(userId: string, notificationId: string) {
    const [row] = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();
    if (!row) throw new NotFoundError('Notification');
    return toNotificationDto(row);
  }

  async markAllRead(userId: string) {
    const rows = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return { updated: rows.length };
  }
}
