import { apiClient } from './api-client';
import type {
  AdminReport,
  AdminUser,
  AiExplanation,
  Answer,
  Classification,
  Comment,
  ModerationQuestion,
  Notification,
  Paginated,
  PersonalInfoCheck,
  PlatformStatistics,
  Question,
  QuestionStatus,
  ReportReason,
  ReportStatus,
  ReportTarget,
  Role,
  StudentStatistics,
  Subject,
  TeacherAnswer,
  TeacherStatistics,
  User,
} from './types';

type Query = Record<string, string | number | boolean | undefined | null>;

function clean(params: Query = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

const get = async <T>(url: string, params?: Query) =>
  (await apiClient.get<T>(url, { params: clean(params) })).data;
const post = async <T>(url: string, body?: unknown) =>
  (await apiClient.post<T>(url, body ?? {})).data;
const patch = async <T>(url: string, body?: unknown) =>
  (await apiClient.patch<T>(url, body ?? {})).data;
const put = async <T>(url: string, body?: unknown) =>
  (await apiClient.put<T>(url, body ?? {})).data;
const del = async <T = void>(url: string) => (await apiClient.delete<T>(url)).data;

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  department: string;
  academicYear: number;
  rollNumber?: string;
}

export interface QuestionFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  subjectId?: string;
  status?: QuestionStatus;
  mine?: boolean;
  unanswered?: boolean;
  sort?: 'newest' | 'oldest' | 'most_answered';
}

export interface CreateQuestionInput {
  title: string;
  description: string;
  subjectId?: string;
  acknowledgePersonalInfo?: boolean;
}

export const api = {
  auth: {
    me: () => get<{ user: User }>('/auth/me').then((r) => r.user),
    login: (body: { email: string; password: string }) =>
      post<{ user: User }>('/auth/login', body).then((r) => r.user),
    register: (body: RegisterInput) =>
      post<{ user: User }>('/auth/register', body).then((r) => r.user),
    logout: () => post<void>('/auth/logout'),
  },

  users: {
    updateProfile: (
      body: Partial<Pick<User, 'fullName' | 'department'>> & { academicYear?: number },
    ) => patch<{ user: User }>('/users/me', body).then((r) => r.user),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      patch<{ user: User }>('/users/me/password', body).then((r) => r.user),
    statistics: () => get<StudentStatistics>('/users/me/statistics'),
  },

  subjects: {
    list: (params?: { includeInactive?: boolean }) =>
      get<{ items: Subject[] }>('/subjects', params).then((r) => r.items),
    create: (body: { name: string; code: string; category: string; description?: string }) =>
      post<Subject>('/subjects', body),
    update: (
      id: string,
      body: Partial<Pick<Subject, 'name' | 'code' | 'category' | 'description' | 'isActive'>>,
    ) => patch<Subject>(`/subjects/${id}`, body),
  },

  questions: {
    list: (filters: QuestionFilters) => get<Paginated<Question>>('/questions', filters as Query),
    get: (id: string) => get<Question>(`/questions/${id}`),
    create: (body: CreateQuestionInput) => post<Question>('/questions', body),
    update: (id: string, body: Partial<CreateQuestionInput> & { status?: 'OPEN' | 'CLOSED' }) =>
      patch<Question>(`/questions/${id}`, body),
    remove: (id: string) => del(`/questions/${id}`),
    answers: (id: string) =>
      get<{ items: Answer[] }>(`/questions/${id}/answers`).then((r) => r.items),
    addAnswer: (id: string, content: string) =>
      post<Answer>(`/questions/${id}/answers`, { content }),
    comments: (id: string) =>
      get<{ items: Comment[] }>(`/questions/${id}/comments`).then((r) => r.items),
    addComment: (id: string, content: string) =>
      post<Comment>(`/questions/${id}/comments`, { content }),
  },

  answers: {
    update: (id: string, content: string) => patch<Answer>(`/answers/${id}`, { content }),
    remove: (id: string) => del(`/answers/${id}`),
    accept: (id: string) => post<Answer>(`/answers/${id}/accept`),
    setUseful: (id: string, useful: boolean) =>
      useful ? put<Answer>(`/answers/${id}/useful`) : del<Answer>(`/answers/${id}/useful`),
  },

  comments: {
    remove: (id: string) => del(`/comments/${id}`),
  },

  ai: {
    status: () => get<{ available: boolean; model: string | null }>('/ai/status'),
    classify: (body: { title: string; description: string }) =>
      post<Classification>('/ai/classify-question', body),
    checkPersonalInformation: (text: string) =>
      post<PersonalInfoCheck>('/ai/check-personal-information', { text }),
    explainQuestion: (questionId: string) => post<AiExplanation>('/ai/ask', { questionId }),
    ask: (prompt: string, subjectId?: string) =>
      post<AiExplanation>('/ai/ask', subjectId ? { prompt, subjectId } : { prompt }),
  },

  notifications: {
    list: (params: { page?: number; pageSize?: number; unreadOnly?: boolean }) =>
      get<Paginated<Notification> & { unreadCount: number }>('/notifications', params),
    unreadCount: () => get<{ count: number }>('/notifications/unread-count').then((r) => r.count),
    markRead: (id: string) => patch<Notification>(`/notifications/${id}/read`),
    markAllRead: () => patch<{ updated: number }>('/notifications/read-all'),
  },

  reports: {
    create: (body: {
      targetType: ReportTarget;
      targetId: string;
      reason: ReportReason;
      details?: string;
    }) => post<{ id: string; message: string }>('/reports', body),
  },

  teacher: {
    subjects: () =>
      get<{ items: Pick<Subject, 'id' | 'name' | 'code' | 'category'>[] }>(
        '/teacher/subjects',
      ).then((r) => r.items),
    questions: (params: {
      page?: number;
      pageSize?: number;
      subjectId?: string;
      status?: string;
      unanswered?: boolean;
      search?: string;
    }) => get<Paginated<Question>>('/teacher/questions', params),
    answers: (params: { page?: number; pageSize?: number }) =>
      get<Paginated<TeacherAnswer>>('/teacher/answers', params),
    statistics: () => get<TeacherStatistics>('/teacher/statistics'),
  },

  admin: {
    users: (params: {
      page?: number;
      pageSize?: number;
      role?: Role;
      search?: string;
      isActive?: boolean;
    }) => get<Paginated<AdminUser>>('/admin/users', params),
    user: (id: string) => get<AdminUser>(`/admin/users/${id}`),
    createUser: (body: {
      fullName: string;
      email: string;
      password: string;
      role: Role;
      department: string;
      academicYear?: number;
      subjectIds?: string[];
    }) => post<AdminUser>('/admin/users', body),
    updateUser: (
      id: string,
      body: { fullName?: string; department?: string; role?: Role; isActive?: boolean },
    ) => patch<AdminUser>(`/admin/users/${id}`, body),
    setTeacherSubjects: (id: string, subjectIds: string[]) =>
      put<AdminUser>(`/admin/users/${id}/subjects`, { subjectIds }),
    statistics: () => get<PlatformStatistics>('/admin/statistics'),
    moderationQueue: (params: {
      page?: number;
      pageSize?: number;
      status?: QuestionStatus;
      reportedOnly?: boolean;
      search?: string;
    }) => get<Paginated<ModerationQuestion>>('/admin/questions', params),
    moderate: (
      id: string,
      body: {
        action: 'FLAG' | 'RESTORE' | 'CLOSE' | 'DELETE';
        note?: string;
        suspendAuthor?: boolean;
      },
    ) =>
      patch<{ id: string; action: string; authorSuspended: boolean }>(
        `/admin/questions/${id}/moderate`,
        body,
      ),
    reports: (params: {
      page?: number;
      pageSize?: number;
      status?: ReportStatus;
      targetType?: ReportTarget;
    }) => get<Paginated<AdminReport>>('/admin/reports', params),
    resolveReport: (
      id: string,
      body: { status: 'RESOLVED' | 'DISMISSED'; resolutionNote?: string; removeContent?: boolean },
    ) => patch<{ id: string; status: ReportStatus }>(`/admin/reports/${id}`, body),
  },
};
