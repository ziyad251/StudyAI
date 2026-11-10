import type { UserRole } from '../db/schema.js';
import type { AdminUserRecord, SelfUserRecord } from '../repositories/user.repository.js';
import type {
  ModerationQuestionRecord,
  PublicQuestionRecord,
} from '../repositories/question.repository.js';
import type { PublicAnswerRecord, PublicCommentRecord } from '../repositories/answer.repository.js';

const iso = (date: Date | string) => new Date(date).toISOString();
const isoOrNull = (date: Date | string | null) => (date ? iso(date) : null);

export function toSelfUserDto(user: SelfUserRecord) {
  return {
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    department: user.department,
    academicYear: user.academicYear,
    rollNumber: user.rollNumber,
    createdAt: iso(user.createdAt),
  };
}
export type SelfUserDto = ReturnType<typeof toSelfUserDto>;

export function toAdminUserDto(
  user: AdminUserRecord,
  subjects?: { id: string; name: string; code: string }[],
) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    department: user.department,
    academicYear: user.academicYear,
    rollNumber: user.rollNumber,
    isActive: user.isActive,
    lastLoginAt: isoOrNull(user.lastLoginAt),
    createdAt: iso(user.createdAt),
    ...(subjects ? { subjects: subjects.map(({ id, name, code }) => ({ id, name, code })) } : {}),
  };
}

export function toSubjectDto(subject: {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string | null;
  isActive: boolean;
  questionCount?: number;
  teacherCount?: number;
}) {
  return {
    id: subject.id,
    name: subject.name,
    code: subject.code,
    category: subject.category,
    description: subject.description,
    isActive: subject.isActive,
    ...(subject.questionCount !== undefined ? { questionCount: subject.questionCount } : {}),
    ...(subject.teacherCount !== undefined ? { teacherCount: subject.teacherCount } : {}),
  };
}

export function toPublicQuestionDto(q: PublicQuestionRecord) {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    subject: { id: q.subjectId, name: q.subjectName, code: q.subjectCode },
    category: q.aiCategory ?? q.subjectCategory,
    status: q.status,
    answerCount: Number(q.answerCount),
    commentCount: Number(q.commentCount),
    hasTeacherAnswer: Boolean(q.hasTeacherAnswer),
    hasAcceptedAnswer: Boolean(q.hasAcceptedAnswer),
    isOwn: Boolean(q.isOwn),
    createdAt: iso(q.createdAt),
    updatedAt: iso(q.updatedAt),
  };
}
export type PublicQuestionDto = ReturnType<typeof toPublicQuestionDto>;

export function toModerationQuestionDto(q: ModerationQuestionRecord) {
  return {
    ...toPublicQuestionDto(q),
    aiConfidence: q.aiConfidence,
    moderationNote: q.moderationNote,
    openReportCount: Number(q.openReportCount),
  };
}

const ANONYMOUS_STUDENT = 'Anonymous student';

function toPublicAuthor(row: {
  authorRole: UserRole;
  authorPublicName: string | null;
  isQuestionAuthor: boolean;
}) {
  const displayName =
    row.authorRole === 'TEACHER'
      ? (row.authorPublicName ?? 'Teacher')
      : row.authorRole === 'ADMIN'
        ? 'Moderator'
        : ANONYMOUS_STUDENT;
  return { role: row.authorRole, displayName, isQuestionAuthor: Boolean(row.isQuestionAuthor) };
}

export function toPublicAnswerDto(a: PublicAnswerRecord) {
  return {
    id: a.id,
    questionId: a.questionId,
    content: a.content,
    isAccepted: a.isAccepted,
    usefulCount: Number(a.usefulCount),
    viewerMarkedUseful: Boolean(a.viewerMarkedUseful),
    author: toPublicAuthor(a),
    isOwn: Boolean(a.isOwn),
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  };
}

export function toPublicCommentDto(c: PublicCommentRecord) {
  return {
    id: c.id,
    questionId: c.questionId,
    content: c.content,
    author: toPublicAuthor(c),
    isOwn: Boolean(c.isOwn),
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

export function toNotificationDto(n: {
  id: string;
  type: string;
  title: string;
  message: string;
  questionId: string | null;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    questionId: n.questionId,
    isRead: n.isRead,
    createdAt: iso(n.createdAt),
  };
}

export function toAiExplanationDto(
  e: { content: string; model: string; createdAt: Date },
  cached: boolean,
) {
  return {
    content: e.content,
    model: e.model,
    generatedAt: iso(e.createdAt),
    cached,
    isAiGenerated: true as const,
    disclaimer:
      'AI-generated explanation. It may contain mistakes – verify with your teacher or course material.',
  };
}
