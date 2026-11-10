import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['STUDENT', 'TEACHER', 'ADMIN']);
export const questionStatusEnum = pgEnum('question_status', [
  'OPEN',
  'ANSWERED',
  'CLOSED',
  'FLAGGED',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'NEW_ANSWER',
  'ANSWER_ACCEPTED',
  'NEW_COMMENT',
  'NEW_QUESTION_IN_SUBJECT',
  'QUESTION_MODERATED',
  'REPORT_RESOLVED',
]);
export const reportTargetEnum = pgEnum('report_target', ['QUESTION', 'ANSWER', 'COMMENT']);
export const reportReasonEnum = pgEnum('report_reason', [
  'SPAM',
  'INAPPROPRIATE',
  'HARASSMENT',
  'PERSONAL_INFORMATION',
  'OFF_TOPIC',
  'OTHER',
]);
export const reportStatusEnum = pgEnum('report_status', ['OPEN', 'RESOLVED', 'DISMISSED']);

export const USER_ROLES = userRoleEnum.enumValues;
export const QUESTION_STATUSES = questionStatusEnum.enumValues;
export const REPORT_REASONS = reportReasonEnum.enumValues;
export const REPORT_TARGETS = reportTargetEnum.enumValues;
export const REPORT_STATUSES = reportStatusEnum.enumValues;

export type UserRole = (typeof USER_ROLES)[number];
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    role: userRoleEnum('role').notNull().default('STUDENT'),
    department: varchar('department', { length: 120 }).notNull(),
    academicYear: smallint('academic_year'),
    rollNumber: varchar('roll_number', { length: 40 }).unique(),
    isActive: boolean('is_active').notNull().default(true),
    tokenVersion: integer('token_version').notNull().default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('users_role_idx').on(t.role),
    check(
      'users_academic_year_range',
      sql`${t.academicYear} IS NULL OR (${t.academicYear} BETWEEN 1 AND 6)`,
    ),
  ],
);

export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  category: varchar('category', { length: 80 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const teacherSubjects = pgTable(
  'teacher_subjects',
  {
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.teacherId, t.subjectId] }),
    index('teacher_subjects_subject_idx').on(t.subjectId),
  ],
);

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    status: questionStatusEnum('status').notNull().default('OPEN'),
    aiCategory: varchar('ai_category', { length: 80 }),
    aiConfidence: real('ai_confidence'),
    aiSubjectId: uuid('ai_subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    moderationNote: text('moderation_note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('questions_subject_status_created_idx').on(t.subjectId, t.status, t.createdAt),
    index('questions_status_created_idx').on(t.status, t.createdAt),
    index('questions_author_idx').on(t.authorId),
    index('questions_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.description})`,
    ),
    check(
      'questions_ai_confidence_range',
      sql`${t.aiConfidence} IS NULL OR (${t.aiConfidence} >= 0 AND ${t.aiConfidence} <= 1)`,
    ),
  ],
);

export const answers = pgTable(
  'answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isAccepted: boolean('is_accepted').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('answers_question_created_idx').on(t.questionId, t.createdAt),
    index('answers_author_idx').on(t.authorId),
    uniqueIndex('answers_one_accepted_per_question')
      .on(t.questionId)
      .where(sql`${t.isAccepted} = true`),
  ],
);

export const answerVotes = pgTable(
  'answer_votes',
  {
    answerId: uuid('answer_id')
      .notNull()
      .references(() => answers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.answerId, t.userId] })],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('comments_question_created_idx').on(t.questionId, t.createdAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    questionId: uuid('question_id').references(() => questions.id, { onDelete: 'cascade' }),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_read_created_idx').on(t.userId, t.isRead, t.createdAt)],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: reportTargetEnum('target_type').notNull(),
    questionId: uuid('question_id').references(() => questions.id, { onDelete: 'set null' }),
    answerId: uuid('answer_id').references(() => answers.id, { onDelete: 'set null' }),
    commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'set null' }),
    contextQuestionId: uuid('context_question_id').references(() => questions.id, {
      onDelete: 'set null',
    }),
    contentSnapshot: text('content_snapshot').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('OPEN'),
    resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('reports_status_created_idx').on(t.status, t.createdAt),
    index('reports_question_idx').on(t.questionId),
    index('reports_answer_idx').on(t.answerId),
    index('reports_comment_idx').on(t.commentId),
    uniqueIndex('reports_unique_reporter_question')
      .on(t.reporterId, t.questionId)
      .where(sql`${t.questionId} IS NOT NULL`),
    uniqueIndex('reports_unique_reporter_answer')
      .on(t.reporterId, t.answerId)
      .where(sql`${t.answerId} IS NOT NULL`),
    uniqueIndex('reports_unique_reporter_comment')
      .on(t.reporterId, t.commentId)
      .where(sql`${t.commentId} IS NOT NULL`),
    check(
      'reports_target_matches_type',
      sql`(${t.targetType} = 'QUESTION' AND ${t.answerId} IS NULL AND ${t.commentId} IS NULL)
       OR (${t.targetType} = 'ANSWER' AND ${t.questionId} IS NULL AND ${t.commentId} IS NULL)
       OR (${t.targetType} = 'COMMENT' AND ${t.questionId} IS NULL AND ${t.answerId} IS NULL)`,
    ),
  ],
);

export const aiExplanations = pgTable('ai_explanations', {
  questionId: uuid('question_id')
    .primaryKey()
    .references(() => questions.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  model: varchar('model', { length: 80 }).notNull(),
  createdAt: createdAt(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SubjectRow = typeof subjects.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
