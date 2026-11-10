import { pino, type Logger } from 'pino';

export function createLogger(level: string, pretty = false): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}

export type { Logger };
