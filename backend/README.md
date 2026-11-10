# StudyAI – Backend

Express 5 + TypeScript REST API with PostgreSQL (Drizzle ORM) and Google Gemini.

## Scripts

| Command                              | Purpose                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `npm run dev`                        | Start with hot reload (`tsx watch`), reading `.env`                         |
| `npm run build` / `npm start`        | Compile to `dist/` / run the compiled server                                |
| `npm test`                           | Unit + integration tests (PGlite, mocked Gemini – no external services)     |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit`                                                     |
| `npm run db:generate`                | Generate a SQL migration from `src/db/schema.ts`                            |
| `npm run db:migrate`                 | Apply migrations (`DATABASE_URL_UNPOOLED` preferred)                        |
| `npm run db:migrate:prod`            | Same, from compiled output                                                  |
| `npm run db:seed [-- --demo]`        | Seed subjects (and demo accounts/content outside production)                |
| `npm run create-admin`               | Create the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` |
| `npm run db:studio`                  | Drizzle Studio                                                              |

## Structure

```
src/
  app.ts                 createApp({ config, db, aiProvider }) – composition of middleware & routes
  server.ts              process entry: config, DB pool, Gemini provider, graceful shutdown
  config/env.ts          Zod-validated environment → typed AppConfig (fails fast)
  db/                    schema.ts, client.ts, migrate.ts, seed.ts, seeders.ts, seed-data.ts
  routes/index.ts        route table (path → auth/role/rate-limit → controller)
  controllers/           thin HTTP adapters
  services/              business logic; services/ai/ for Gemini, prompts, PII detector
  repositories/          privacy-critical queries with explicit projections
  serializers/           response DTOs (whitelists)
  middleware/            auth, csrf, rate-limit, error-handler
  validators/            Zod request schemas
  utils/                 errors, jwt, password, pagination, logger, text helpers
  scripts/create-admin.ts
drizzle/                 generated SQL migrations (committed)
tests/
  helpers/               PGlite test DB, app factory & clients, mock AI, privacy deep-scan
  unit/                  PII detector, config, tokens, utilities
  db/                    schema & constraint tests
  integration/           auth, privacy, questions, answers, RBAC, admin, AI, security
```

## Request lifecycle

`helmet → cors → pino-http → json(100kb) → cookie-parser → global rate limit → CSRF guard → route
(requireAuth → requireRole → limiter) → controller (Zod parse) → service → repository → serializer → JSON`.
Errors propagate (Express 5 handles async errors) to `createErrorHandler`, which emits the uniform error shape.

## Adding an endpoint

1. Zod schema in `validators/`.
2. Service method with permission checks (throw `AppError` subclasses).
3. Repository function if it touches user-linked data – select explicit columns only.
4. Serializer for the response.
5. Controller + route with the right `requireAuth`/`requireRole`.
6. Tests – include a privacy assertion (`expectNoPrivateData`) and add the route to `rbac.test.ts`.

See the [root README](../README.md) and [API reference](../docs/API.md).
