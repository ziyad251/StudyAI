import type { Logger } from 'pino';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import { TokenService } from '../utils/jwt.js';
import type { AiProvider } from './ai/ai.provider.js';
import { AiService } from './ai/ai.service.js';
import { AdminService } from './admin.service.js';
import { AnswerService } from './answer.service.js';
import { AuthService } from './auth.service.js';
import { NotificationService } from './notification.service.js';
import { QuestionService } from './question.service.js';
import { ReportService } from './report.service.js';
import { SubjectService } from './subject.service.js';
import { TeacherService } from './teacher.service.js';

export function createServices(deps: {
  db: Database;
  config: AppConfig;
  aiProvider: AiProvider | null;
  logger: Logger;
}) {
  const { db, config, logger } = deps;
  const tokens = new TokenService(config.jwt.secret, config.jwt.expiresInSeconds);
  const notifications = new NotificationService(db);
  const ai = new AiService(db, deps.aiProvider, logger);

  return {
    tokens,
    notifications,
    ai,
    auth: new AuthService(db, config, tokens),
    questions: new QuestionService(db, config, ai, notifications),
    answers: new AnswerService(db, notifications),
    subjects: new SubjectService(db),
    reports: new ReportService(db, config, notifications),
    teacher: new TeacherService(db),
    admin: new AdminService(db, notifications),
  };
}

export type Services = ReturnType<typeof createServices>;
