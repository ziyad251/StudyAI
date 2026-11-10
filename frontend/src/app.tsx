import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PublicLayout } from '@/components/layout/public-layout';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import { LandingPage } from '@/pages/public/landing-page';
import { LoginPage } from '@/pages/public/login-page';
import { NotFoundPage } from '@/pages/public/not-found-page';
import { RegisterPage } from '@/pages/public/register-page';
import { BrowseQuestionsPage, MyQuestionsPage } from '@/pages/shared/browse-questions-page';
import { StudentDashboardPage } from '@/pages/student/dashboard-page';

const QuestionDetailPage = lazy(() =>
  import('@/pages/shared/question-detail-page').then((m) => ({ default: m.QuestionDetailPage })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/shared/notifications-page').then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/shared/profile-page').then((m) => ({ default: m.ProfilePage })),
);
const AskQuestionPage = lazy(() =>
  import('@/pages/student/ask-question-page').then((m) => ({ default: m.AskQuestionPage })),
);

const AiAssistantPage = lazy(() =>
  import('@/pages/shared/ai-assistant-page').then((m) => ({ default: m.AiAssistantPage })),
);
const teacher = () => import('@/pages/teacher/teacher-pages');
const TeacherDashboardPage = lazy(() =>
  teacher().then((m) => ({ default: m.TeacherDashboardPage })),
);
const AssignedQuestionsPage = lazy(() =>
  teacher().then((m) => ({ default: m.AssignedQuestionsPage })),
);
const TeacherAnswersPage = lazy(() => teacher().then((m) => ({ default: m.TeacherAnswersPage })));
const adminDash = () => import('@/pages/admin/dashboard-pages');
const AdminDashboardPage = lazy(() => adminDash().then((m) => ({ default: m.AdminDashboardPage })));
const AnalyticsPage = lazy(() => adminDash().then((m) => ({ default: m.AnalyticsPage })));
const UsersPage = lazy(() =>
  import('@/pages/admin/users-page').then((m) => ({ default: m.UsersPage })),
);
const SubjectsPage = lazy(() =>
  import('@/pages/admin/subjects-page').then((m) => ({ default: m.SubjectsPage })),
);
const moderation = () => import('@/pages/admin/moderation-pages');
const ModerationPage = lazy(() => moderation().then((m) => ({ default: m.ModerationPage })));
const ReportsPage = lazy(() => moderation().then((m) => ({ default: m.ReportsPage })));

function PageFallback() {
  return (
    <div className="flex justify-center py-20" role="status" aria-label="Loading page">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
        </Route>
        <Route element={<GuestOnly />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="questions" element={<BrowseQuestionsPage />} />
            <Route path="questions/:id" element={<QuestionDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />

            <Route element={<RequireAuth roles={['STUDENT', 'TEACHER']} />}>
              <Route path="assistant" element={<AiAssistantPage />} />
            </Route>

            <Route element={<RequireAuth roles={['STUDENT']} />}>
              <Route path="dashboard" element={<StudentDashboardPage />} />
              <Route path="questions/ask" element={<AskQuestionPage />} />
              <Route path="my-questions" element={<MyQuestionsPage />} />
            </Route>

            <Route path="teacher" element={<RequireAuth roles={['TEACHER']} />}>
              <Route index element={<TeacherDashboardPage />} />
              <Route path="questions" element={<AssignedQuestionsPage />} />
              <Route path="answers" element={<TeacherAnswersPage />} />
            </Route>

            <Route path="admin" element={<RequireAuth roles={['ADMIN']} />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="subjects" element={<SubjectsPage />} />
              <Route path="moderation" element={<ModerationPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
