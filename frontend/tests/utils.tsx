import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { AppProviders } from '@/providers';
import type { Question, User } from '@/lib/types';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    email: 'student@college.edu',
    fullName: 'Test Student',
    role: 'STUDENT',
    department: 'Computer Science',
    academicYear: 2,
    rollNumber: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    title: 'How does normalization work in DBMS?',
    description: 'Can someone explain 2NF and 3NF?',
    subject: { id: 's-1', name: 'Database Management Systems', code: 'CS202' },
    category: 'Normalization',
    status: 'OPEN',
    answerCount: 2,
    commentCount: 0,
    hasTeacherAnswer: true,
    hasAcceptedAnswer: false,
    isOwn: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function testQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderApp(
  ui: ReactElement,
  { route = '/', path = '/', extraRoutes = [] as { path: string; element: ReactElement }[] } = {},
) {
  const queryClient = testQueryClient();
  return {
    queryClient,
    ...render(
      <MemoryRouter initialEntries={[route]}>
        <AppProviders queryClient={queryClient}>
          <Routes>
            <Route path={path} element={ui} />
            {extraRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    ),
  };
}
