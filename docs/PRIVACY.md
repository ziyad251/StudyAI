# StudyAI privacy model

StudyAI provides **pseudonymity towards other users**, not absolute anonymity. This document states exactly what is
and is not protected.

## What is guaranteed (and tested)

| Who                     | Can see                                                                                          | Cannot see                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Other students          | Question/answer/comment content, subject, status, timestamps; teacher names on teacher answers   | Author name, email, roll number, department, year, or any user id for student-written content |
| Teachers                | Same as students                                                                                 | Same as students                                                                              |
| Admins (via the API/UI) | All content including hidden questions; user accounts and their contact details; report contents | **Who wrote any question, answer or comment**, and who filed a report                         |
| The author              | That a question is theirs (`isOwn`)                                                              | –                                                                                             |
| Google Gemini           | Question text with structured identifiers redacted                                               | Any account data, ids, emails or names                                                        |

These guarantees are enforced in SQL projections and response serializers and verified by
`backend/tests/integration/privacy.test.ts`, which deep-scans API responses for private keys and values.

## Known limitations

1. **The database knows.** `questions.author_id`, `answers.author_id`, `comments.author_id` and
   `reports.reporter_id` exist for account management, ownership and abuse prevention. Anyone with direct database
   access (database administrators, operators with production credentials, a database breach, or a legal request)
   can link content to accounts.
2. **Admin suspension is linkable in aggregate.** If an admin suspends “the author of question X” and then sees which
   account became suspended, they learn the author. This is an intentional accountability trade-off; the UI does
   not surface it, but it is not cryptographically prevented.
3. **Content can identify people.** Writing style, very specific circumstances, or details deliberately included can
   reveal the author. The personal-information check helps but **cannot detect everything**.
4. **Metadata.** Timestamps may correlate with observable behaviour (e.g. a question posted seconds after someone
   leaves a lecture hall). Small classes or rare subjects shrink the anonymity set.
5. **Within a thread** the asker's own answers and comments carry an “Asker” badge, linking them to each other (but
   not to an identity). There are no stable pseudonyms across threads.
6. **Logs.** Server logs record request paths and timings (never cookies, passwords or tokens). Hosting providers
   (Render, Vercel, Neon) process network metadata such as IP addresses.
7. **AI processing.** Question text is sent to Google's Gemini API, subject to Google's terms. Unstructured personal
   details that the regex layer does not catch may be included.

## Recommendations for operators

- Restrict production database credentials to as few people as possible; enable Neon IP allow-lists and audit logs.
- Publish a policy describing when (if ever) identities may be looked up and who approves it.
- Keep `ALLOWED_EMAIL_DOMAINS` set so only real students can register.
