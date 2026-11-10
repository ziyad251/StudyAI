export const queryKeys = {
  me: ['auth', 'me'] as const,
  aiStatus: ['ai', 'status'] as const,
  subjects: (includeInactive = false) => ['subjects', { includeInactive }] as const,
  questions: {
    all: ['questions'] as const,
    list: (filters: object) => ['questions', 'list', filters] as const,
    detail: (id: string) => ['questions', 'detail', id] as const,
    answers: (id: string) => ['questions', 'detail', id, 'answers'] as const,
    comments: (id: string) => ['questions', 'detail', id, 'comments'] as const,
  },
  studentStats: ['users', 'me', 'statistics'] as const,
  notifications: {
    all: ['notifications'] as const,
    list: (params: object) => ['notifications', 'list', params] as const,
    unread: ['notifications', 'unread'] as const,
  },
  teacher: {
    all: ['teacher'] as const,
    subjects: ['teacher', 'subjects'] as const,
    questions: (params: object) => ['teacher', 'questions', params] as const,
    answers: (params: object) => ['teacher', 'answers', params] as const,
    stats: ['teacher', 'statistics'] as const,
  },
  admin: {
    all: ['admin'] as const,
    users: (params: object) => ['admin', 'users', params] as const,
    user: (id: string) => ['admin', 'users', id] as const,
    stats: ['admin', 'statistics'] as const,
    moderation: (params: object) => ['admin', 'moderation', params] as const,
    reports: (params: object) => ['admin', 'reports', params] as const,
  },
};
