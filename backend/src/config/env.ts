import { z } from 'zod';

const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.url({ message: 'DATABASE_URL must be a valid PostgreSQL connection URL' }),
    DATABASE_URL_UNPOOLED: z.url().optional(),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    JWT_PREVIOUS_SECRETS: csv.pipe(
      z.array(z.string().min(32, 'JWT_PREVIOUS_SECRETS entries must be at least 32 characters')),
    ),
    JWT_EXPIRES_IN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 7),

    FRONTEND_URL: csv.pipe(z.array(z.url()).min(1, 'FRONTEND_URL must contain at least one URL')),

    ALLOWED_EMAIL_DOMAINS: csv,

    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    AI_CLASSIFICATION_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),

    TRUST_PROXY: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v === 'false' ? 0 : v === 'true' ? 1 : Number(v)))
      .pipe(z.number().int().min(0).max(5, 'TRUST_PROXY must be false, true or a hop count 0-5')),
    AUTO_FLAG_REPORT_THRESHOLD: z.coerce.number().int().positive().default(3),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_SECRET.includes('change-me')) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET still contains the placeholder value',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface RateLimitConfig {
  windowMs: number;
  limit: number;
}

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  migrationDatabaseUrl: string;
  jwt: { secret: string; previousSecrets: string[]; expiresInSeconds: number };
  cors: { origins: string[] };
  cookie: { name: string; secure: boolean; sameSite: 'lax' | 'strict' | 'none' };
  allowedEmailDomains: string[];
  trustProxy: number;
  autoFlagReportThreshold: number;
  logLevel: NonNullable<Env['LOG_LEVEL']>;
  ai: {
    apiKey: string | undefined;
    model: string;
    timeoutMs: number;
    classificationMinConfidence: number;
  };
  rateLimits: {
    global: RateLimitConfig;
    auth: RateLimitConfig;
    ai: RateLimitConfig;
    write: RateLimitConfig;
  };
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

export function buildConfig(env: Env): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  const minute = 60 * 1000;

  return {
    env: env.NODE_ENV,
    isProduction,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    migrationDatabaseUrl: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL,
    jwt: {
      secret: env.JWT_SECRET,
      previousSecrets: env.JWT_PREVIOUS_SECRETS.filter((secret) => secret !== env.JWT_SECRET),
      expiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
    },
    cors: { origins: env.FRONTEND_URL },
    cookie: {
      name: isProduction ? '__Host-studyai_session' : 'studyai_session',
      secure: isProduction,
      sameSite: 'lax',
    },
    allowedEmailDomains: env.ALLOWED_EMAIL_DOMAINS.map((domain) => domain.toLowerCase()),
    trustProxy: env.TRUST_PROXY,
    autoFlagReportThreshold: env.AUTO_FLAG_REPORT_THRESHOLD,
    logLevel:
      env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug'),
    ai: {
      apiKey: env.GEMINI_API_KEY || undefined,
      model: env.GEMINI_MODEL,
      timeoutMs: env.AI_TIMEOUT_MS,
      classificationMinConfidence: env.AI_CLASSIFICATION_MIN_CONFIDENCE,
    },
    rateLimits: {
      global: { windowMs: 15 * minute, limit: 1000 },
      auth: { windowMs: 15 * minute, limit: 20 },
      ai: { windowMs: 60 * minute, limit: 30 },
      write: { windowMs: 15 * minute, limit: 120 },
    },
  };
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return buildConfig(parseEnv(source));
}
