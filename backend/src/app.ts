import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.js';
import type { Database } from './db/client.js';
import { csrfProtection } from './middleware/csrf.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { createApiRouter } from './routes/index.js';
import type { AiProvider } from './services/ai/ai.provider.js';
import { createServices } from './services/index.js';
import { createLogger, type Logger } from './utils/logger.js';

export interface AppDependencies {
  config: AppConfig;
  db: Database;
  aiProvider: AiProvider | null;
  logger?: Logger;
}

export function createApp(deps: AppDependencies): Express {
  const { config, db } = deps;
  const logger = deps.logger ?? createLogger(config.logLevel);
  const services = createServices({ db, config, aiProvider: deps.aiProvider, logger });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy > 0 ? config.trustProxy : false);

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.cors.origins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', createRateLimiter(config.rateLimits.global, { keyBy: 'ip' }));
  app.use('/api', csrfProtection);
  app.use('/api', createApiRouter({ db, config, services }));

  app.get('/', (_req, res) => {
    res.json({ name: 'StudyAI API', docs: '/api/health' });
  });

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
