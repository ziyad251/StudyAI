import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createDatabase } from './db/client.js';
import { GeminiProvider } from './services/ai/gemini.provider.js';
import { createLogger } from './utils/logger.js';

function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel, config.env === 'development');
  const database = createDatabase(config.databaseUrl);

  const aiProvider = config.ai.apiKey
    ? new GeminiProvider(config.ai.apiKey, config.ai.model, config.ai.timeoutMs)
    : null;
  if (!aiProvider) logger.warn('GEMINI_API_KEY is not set – AI features are disabled.');

  const app = createApp({ config, db: database.db, aiProvider, logger });

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(
      { port: config.port, env: config.env, ai: aiProvider?.model ?? 'disabled' },
      'StudyAI API listening',
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      database.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
