export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type QuestionStatus = 'OPEN' | 'ANSWERED' | 'CLOSED' | 'FLAGGED';
export type ReportReason =
  'SPAM' | 'INAPPROPRIATE' | 'HARASSMENT' | 'PERSONAL_INFORMATION' | 'OFF_TOPIC' | 'OTHER';
export type ReportTarget = 'QUESTION' | 'ANSWER' | 'COMMENT';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface User {
  email: string;
  fullName: string;
  role: Role;
  department: string;
  academicYear: number | null;
  rollNumber: string | null;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string | null;
  isActive: boolean;
  questionCount?: number;
  teacherCount?: number;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  subject: { id: string; name: string; code: string };
  category: string;
  status: QuestionStatus;
  answerCount: number;
  commentCount: number;
  hasTeacherAnswer: boolean;
  hasAcceptedAnswer: boolean;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationQuestion extends Question {
  aiConfidence: number | null;
  moderationNote: string | null;
  openReportCount: number;
}

export interface PublicAuthor {
  role: Role;
  displayName: string;
  isQuestionAuthor: boolean;
}

export interface Answer {
  id: string;
  questionId: string;
  content: string;
  isAccepted: boolean;
  usefulCount: number;
  viewerMarkedUseful: boolean;
  author: PublicAuthor;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  questionId: string;
  content: string;
  author: PublicAuthor;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type:
    | 'NEW_ANSWER'
    | 'ANSWER_ACCEPTED'
    | 'NEW_COMMENT'
    | 'NEW_QUESTION_IN_SUBJECT'
    | 'QUESTION_MODERATED'
    | 'REPORT_RESOLVED';
  title: string;
  message: string;
  questionId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Classification {
  subjectId: string;
  subject: string;
  subjectCode: string;
  category: string;
  confidence: number;
}

export interface PiiFinding {
  type: string;
  excerpt: string;
  message: string;
  source: 'PATTERN' | 'AI';
}

export interface PersonalInfoCheck {
  hasPersonalInformation: boolean;
  findings: PiiFinding[];
  aiChecked: boolean;
  disclaimer: string;
}

export interface AiExplanation {
  content: string;
  model: string | null;
  generatedAt: string;
  cached: boolean;
  isAiGenerated: true;
  disclaimer: string;
}

export interface StudentStatistics {
  totalQuestions: number;
  open: number;
  answered: number;
  closed: number;
  flagged: number;
}

export interface TeacherStatistics {
  assignedSubjects: number;
  totalQuestions: number;
  openQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  myAnswers: number;
  myAcceptedAnswers: number;
  perSubject: {
    subjectId: string;
    name: string;
    code: string;
    total: number;
    open: number;
    answered: number;
    closed: number;
    unanswered: number;
  }[];
}

export interface TeacherAnswer {
  id: string;
  content: string;
  isAccepted: boolean;
  usefulCount: number;
  createdAt: string;
  updatedAt: string;
  question: { id: string; title: string; status: QuestionStatus; subject: string };
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department: string;
  academicYear: number | null;
  rollNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  subjects?: { id: string; name: string; code: string }[];
}

export interface AdminReport {
  id: string;
  targetType: ReportTarget;
  targetId: string | null;
  targetRemoved: boolean;
  question: { id: string; title: string | null; status: QuestionStatus | null } | null;
  contentSnapshot: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reportCount: number;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PlatformStatistics {
  users: { total: number; students: number; teachers: number; admins: number; suspended: number };
  questions: {
    total: number;
    open: number;
    answered: number;
    closed: number;
    flagged: number;
    aiClassified: number;
  };
  answers: { total: number; accepted: number };
  comments: { total: number };
  reports: { open: number };
  answerRate: number;
  medianFirstResponseHours: number | null;
  questionsPerSubject: {
    subjectId: string;
    name: string;
    code: string;
    questions: number;
    answered: number;
  }[];
  questionsPerDay: { date: string; count: number }[];
}
