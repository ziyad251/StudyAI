# StudyAI REST API reference

Base path: `/api`. JSON in, JSON out.

**Conventions**

- **Auth:** HttpOnly session cookie (set by register/login). Non-browser clients may send `Authorization: Bearer <jwt>`.
- **CSRF:** every `POST/PUT/PATCH/DELETE` must include `X-Requested-With: XMLHttpRequest` (not needed with Bearer auth).
- **Errors:** `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "path": "email", "message": "…" }] } }`
- **Pagination:** `?page=1&pageSize=10` (max 50) → `{ "items": [...], "pagination": { "page", "pageSize", "total", "totalPages" } }`
- **Bodies are strict:** unknown fields are rejected with 400.

| Status | Meaning                                                                    |
| ------ | -------------------------------------------------------------------------- |
| 400    | Validation error / malformed JSON / malformed id                           |
| 401    | Not authenticated, or invalid/expired/revoked session                      |
| 403    | Authenticated but not allowed (role, ownership, CSRF header missing)       |
| 404    | Not found – also returned for content hidden from you                      |
| 409    | Conflict (duplicate email, already reported, question locked, has answers) |
| 413    | Body larger than 100 kB                                                    |
| 422    | `PERSONAL_INFO_WARNING` or `SUBJECT_REQUIRED`                              |
| 429    | Rate limited (`RATE_LIMITED`)                                              |
| 503    | `AI_UNAVAILABLE` / `AI_BUSY`                                               |

Roles: **S** = student, **T** = teacher, **A** = admin, **any** = any signed-in user.

## Auth & profile

| Method | Path                   | Who    | Body / query                                                            | Response                                                                            |
| ------ | ---------------------- | ------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| POST   | `/auth/register`       | public | `fullName, email, password, department, academicYear(1-6), rollNumber?` | 201 `{user}` + cookie                                                               |
| POST   | `/auth/login`          | public | `email, password`                                                       | 200 `{user}` + cookie · 401 · 403 suspended                                         |
| POST   | `/auth/logout`         | any    | –                                                                       | 204, revokes all sessions                                                           |
| GET    | `/auth/me`             | any    | –                                                                       | `{user}` (`email, fullName, role, department, academicYear, rollNumber, createdAt`) |
| PATCH  | `/users/me`            | any    | `fullName?, department?, academicYear?`                                 | `{user}`                                                                            |
| PATCH  | `/users/me/password`   | any    | `currentPassword, newPassword`                                          | `{user}` + fresh cookie                                                             |
| GET    | `/users/me/statistics` | S      | –                                                                       | `{totalQuestions, open, answered, closed, flagged}`                                 |

## Questions

| Method | Path             | Who                        | Notes                                                                                              |
| ------ | ---------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/questions`     | any                        | `search, subjectId, status, mine, unanswered, sort(newest\|oldest\|most_answered), page, pageSize` |
| POST   | `/questions`     | S                          | `title(10-200), description(20-5000), subjectId?, acknowledgePersonalInfo?` → 201 public question  |
| GET    | `/questions/:id` | any                        | Public question DTO                                                                                |
| PATCH  | `/questions/:id` | S (author)                 | `title?, description?, subjectId?, status?(OPEN\|CLOSED), acknowledgePersonalInfo?`                |
| DELETE | `/questions/:id` | S (author, no answers) / A | 204 · 409 `QUESTION_HAS_ANSWERS`                                                                   |

`POST /questions` flow: personal-information check (422 `PERSONAL_INFO_WARNING` with masked `details.findings`
unless acknowledged) → AI classification → subject = chosen subject, else AI subject if confident, else 422
`SUBJECT_REQUIRED` (with `details.suggestion`).

**Public question DTO:** `id, title, description, subject{id,name,code}, category, status, answerCount, commentCount,
hasTeacherAnswer, hasAcceptedAnswer, isOwn, createdAt, updatedAt`.

## Answers & comments

| Method       | Path                      | Who             | Notes                                                    |
| ------------ | ------------------------- | --------------- | -------------------------------------------------------- |
| GET          | `/questions/:id/answers`  | any             | Accepted first, then teacher answers, then by usefulness |
| POST         | `/questions/:id/answers`  | S, T            | `content(10-10000)`; 409 if closed/under review          |
| PATCH        | `/answers/:id`            | author          | `content`                                                |
| DELETE       | `/answers/:id`            | author / A      | 204                                                      |
| POST         | `/answers/:id/accept`     | question author | Moves the accepted flag; question → ANSWERED             |
| PUT / DELETE | `/answers/:id/useful`     | any (not own)   | Idempotent vote / unvote                                 |
| GET          | `/questions/:id/comments` | any             |                                                          |
| POST         | `/questions/:id/comments` | any             | `content(2-1000)`                                        |
| DELETE       | `/comments/:id`           | author / A      |                                                          |

**Answer DTO:** `id, questionId, content, isAccepted, usefulCount, viewerMarkedUseful, isOwn, createdAt, updatedAt,
author{role, displayName, isQuestionAuthor}` – `displayName` is the teacher's name, `"Moderator"`, or
`"Anonymous student"`.

## Subjects

| Method | Path            | Who    | Notes                                           |
| ------ | --------------- | ------ | ----------------------------------------------- |
| GET    | `/subjects`     | public | `includeInactive=true` honoured for admins only |
| POST   | `/subjects`     | A      | `name, code, category, description?`            |
| PATCH  | `/subjects/:id` | A      | any of the above + `isActive`                   |

## AI

| Method | Path                             | Who  | Body                                         | Response                                                                                      |
| ------ | -------------------------------- | ---- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/ai/status`                     | any  | –                                            | `{available, model}`                                                                          |
| POST   | `/ai/classify-question`          | S    | `title, description`                         | `{subjectId, subject, subjectCode, category, confidence}`                                     |
| POST   | `/ai/check-personal-information` | S    | `text`                                       | `{hasPersonalInformation, findings[{type, excerpt, message, source}], aiChecked, disclaimer}` |
| POST   | `/ai/ask`                        | S, T | `{questionId}` **or** `{prompt, subjectId?}` | `{content, model, generatedAt, cached, isAiGenerated:true, disclaimer}`                       |

AI endpoints are limited to 30 requests per user per hour.

## Notifications

| Method | Path                          | Notes                                                    |
| ------ | ----------------------------- | -------------------------------------------------------- |
| GET    | `/notifications`              | `unreadOnly, page, pageSize` → paginated + `unreadCount` |
| GET    | `/notifications/unread-count` | `{count}`                                                |
| PATCH  | `/notifications/:id/read`     | 404 if not yours                                         |
| PATCH  | `/notifications/read-all`     | `{updated}`                                              |

Types: `NEW_ANSWER, ANSWER_ACCEPTED, NEW_COMMENT, NEW_QUESTION_IN_SUBJECT, QUESTION_MODERATED, REPORT_RESOLVED`.

## Reports

| Method | Path       | Who  | Body                                                                                                                                         |
| ------ | ---------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/reports` | S, T | `targetType(QUESTION\|ANSWER\|COMMENT), targetId, reason(SPAM\|INAPPROPRIATE\|HARASSMENT\|PERSONAL_INFORMATION\|OFF_TOPIC\|OTHER), details?` |

A question is automatically hidden after `AUTO_FLAG_REPORT_THRESHOLD` (default 3) open reports.

## Teacher

| Method | Path                  | Notes                                                                            |
| ------ | --------------------- | -------------------------------------------------------------------------------- |
| GET    | `/teacher/subjects`   | Assigned subjects                                                                |
| GET    | `/teacher/questions`  | `subjectId, status, unanswered, search, page, pageSize` – assigned subjects only |
| GET    | `/teacher/answers`    | The teacher's own answers with question context                                  |
| GET    | `/teacher/statistics` | Totals + per-subject breakdown                                                   |

## Admin (all require ADMIN)

| Method | Path                            | Notes                                                                                                                             |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/users`                  | `role, search, isActive, page, pageSize`                                                                                          |
| POST   | `/admin/users`                  | Provision: `fullName, email, password, role, department, academicYear?, rollNumber?, subjectIds?`                                 |
| GET    | `/admin/users/:id`              | Includes `subjects` for teachers                                                                                                  |
| PATCH  | `/admin/users/:id`              | `fullName?, department?, role?, isActive?` – revokes sessions on role/status change; cannot demote/suspend self or the last admin |
| PUT    | `/admin/users/:id/subjects`     | `subjectIds[]` (teachers only)                                                                                                    |
| GET    | `/admin/statistics`             | Users, questions by status, answers, reports, answer rate, median first-response hours, per-subject and 30-day series             |
| GET    | `/admin/questions`              | Moderation queue: `status, reportedOnly, search` – no author data                                                                 |
| PATCH  | `/admin/questions/:id/moderate` | `action(FLAG\|RESTORE\|CLOSE\|DELETE), note?, suspendAuthor?`                                                                     |
| GET    | `/admin/reports`                | `status, targetType` – includes `contentSnapshot`; no reporter/author identity                                                    |
| PATCH  | `/admin/reports/:id`            | `status(RESOLVED\|DISMISSED), resolutionNote?, removeContent?` – resolves all open reports on the same target                     |

## Health

`GET /health` → `200 {status:"ok", database:"ok", ai:"configured"|"disabled", timestamp}` or `503` when the database
is unreachable.
