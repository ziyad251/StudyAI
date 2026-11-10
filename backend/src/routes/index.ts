import { Router } from 'express';
import { sql } from 'drizzle-orm';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import { createAdminController } from '../controllers/admin.controller.js';
import { createAuthController } from '../controllers/auth.controller.js';
import {
  createAiController,
  createNotificationController,
  createReportController,
  createSubjectController,
  createTeacherController,
} from '../controllers/misc.controller.js';
import {
  createAnswerController,
  createQuestionController,
} from '../controllers/question.controller.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import type { Services } from '../services/index.js';

export function createApiRouter(deps: { db: Database; config: AppConfig; services: Services }) {
  const { db, config, services } = deps;
  const { requireAuth, optionalAuth } = createAuthMiddleware({
    db,
    config,
    tokens: services.tokens,
  });

  const authLimiter = createRateLimiter(config.rateLimits.auth, {
    keyBy: 'ip',
    message: 'Too many authentication attempts. Please wait a few minutes and try again.',
  });
  const aiLimiter = createRateLimiter(config.rateLimits.ai, {
    message: 'You have reached the AI usage limit. Please try again later.',
  });
  const writeLimiter = createRateLimiter(config.rateLimits.write, {
    skipSafeMethods: true,
    message: 'You are doing that too often. Please slow down.',
  });

  const auth = createAuthController(services, config);
  const questions = createQuestionController(services);
  const answers = createAnswerController(services);
  const subjects = createSubjectController(services);
  const notifications = createNotificationController(services);
  const reports = createReportController(services);
  const teacher = createTeacherController(services);
  const ai = createAiController(services);
  const admin = createAdminController(services);

  const router = Router();
  const anyRole = requireRole('STUDENT', 'TEACHER', 'ADMIN');
  const studentOnly = requireRole('STUDENT');
  const contributors = requireRole('STUDENT', 'TEACHER');
  const adminOnly = requireRole('ADMIN');

  router.get('/health', async (_req, res) => {
    let database: 'ok' | 'unavailable' = 'ok';
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      database = 'unavailable';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      ai: services.ai.isAvailable ? 'configured' : 'disabled',
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/auth/register', authLimiter, auth.register);
  router.post('/auth/login', authLimiter, auth.login);
  router.post('/auth/logout', optionalAuth, auth.logout);
  router.get('/auth/me', requireAuth, auth.me);

  router.patch('/users/me', requireAuth, writeLimiter, auth.updateProfile);
  router.patch('/users/me/password', requireAuth, authLimiter, auth.changePassword);
  router.get('/users/me/statistics', requireAuth, studentOnly, auth.myStatistics);

  router.get('/subjects', optionalAuth, subjects.list);
  router.post('/subjects', requireAuth, adminOnly, subjects.create);
  router.patch('/subjects/:id', requireAuth, adminOnly, subjects.update);

  router.get('/questions', requireAuth, anyRole, questions.list);
  router.post('/questions', requireAuth, studentOnly, writeLimiter, questions.create);
  router.get('/questions/:id', requireAuth, anyRole, questions.get);
  router.patch('/questions/:id', requireAuth, studentOnly, writeLimiter, questions.update);
  router.delete('/questions/:id', requireAuth, requireRole('STUDENT', 'ADMIN'), questions.remove);

  router.get('/questions/:id/answers', requireAuth, anyRole, questions.listAnswers);
  router.post(
    '/questions/:id/answers',
    requireAuth,
    contributors,
    writeLimiter,
    questions.createAnswer,
  );
  router.get('/questions/:id/comments', requireAuth, anyRole, questions.listComments);
  router.post(
    '/questions/:id/comments',
    requireAuth,
    anyRole,
    writeLimiter,
    questions.createComment,
  );

  router.patch('/answers/:id', requireAuth, contributors, writeLimiter, answers.update);
  router.delete('/answers/:id', requireAuth, anyRole, answers.remove);
  router.post('/answers/:id/accept', requireAuth, studentOnly, answers.accept);
  router.put('/answers/:id/useful', requireAuth, anyRole, writeLimiter, answers.markUseful);
  router.delete('/answers/:id/useful', requireAuth, anyRole, answers.unmarkUseful);
  router.delete('/comments/:id', requireAuth, anyRole, answers.removeComment);

  router.get('/ai/status', requireAuth, ai.status);
  router.post('/ai/classify-question', requireAuth, studentOnly, aiLimiter, ai.classify);
  router.post(
    '/ai/check-personal-information',
    requireAuth,
    studentOnly,
    aiLimiter,
    ai.checkPersonalInformation,
  );
  router.post('/ai/ask', requireAuth, contributors, aiLimiter, ai.ask);

  router.get('/notifications', requireAuth, notifications.list);
  router.get('/notifications/unread-count', requireAuth, notifications.unreadCount);
  router.patch('/notifications/read-all', requireAuth, notifications.markAllRead);
  router.patch('/notifications/:id/read', requireAuth, notifications.markRead);

  router.post('/reports', requireAuth, contributors, writeLimiter, reports.create);

  const teacherOnly = [requireAuth, requireRole('TEACHER')];
  router.get('/teacher/subjects', ...teacherOnly, teacher.subjects);
  router.get('/teacher/questions', ...teacherOnly, teacher.questions);
  router.get('/teacher/answers', ...teacherOnly, teacher.answers);
  router.get('/teacher/statistics', ...teacherOnly, teacher.statistics);

  const adminRouter = Router();
  adminRouter.use(requireAuth, adminOnly);
  adminRouter.get('/users', admin.listUsers);
  adminRouter.post('/users', admin.createUser);
  adminRouter.get('/users/:id', admin.getUser);
  adminRouter.patch('/users/:id', admin.updateUser);
  adminRouter.put('/users/:id/subjects', admin.setTeacherSubjects);
  adminRouter.get('/statistics', admin.statistics);
  adminRouter.get('/questions', admin.moderationQueue);
  adminRouter.patch('/questions/:id/moderate', admin.moderateQuestion);
  adminRouter.get('/reports', admin.listReports);
  adminRouter.patch('/reports/:id', admin.resolveReport);
  router.use('/admin', adminRouter);

  return router;
}
