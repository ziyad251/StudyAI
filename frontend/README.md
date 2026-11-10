# StudyAI – Frontend

React 19 + Vite 8 + TypeScript SPA styled with Tailwind CSS 4 and shadcn/ui.

## Scripts

| Command                              | Purpose                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Dev server on :5173; proxies `/api` to `VITE_DEV_API_PROXY` (default `http://localhost:4000`) |
| `npm run build` / `npm run preview`  | Type-check + production build / serve `dist/`                                                 |
| `npm test`                           | Vitest + Testing Library (jsdom); the API module is mocked                                    |
| `npm run lint` / `npm run typecheck` | ESLint (incl. React Compiler rules) / `tsc -b`                                                |

## Structure

```
src/
  main.tsx, app.tsx, providers.tsx   router (code-split role areas), Query + Auth providers, toasts
  lib/                               api-client (Axios + ApiError), api (typed endpoints), types (DTOs),
                                     query-keys, query-client, format
  features/auth/                     AuthProvider (session from /auth/me), route guards, Zod form schemas
  components/ui/                     shadcn/ui primitives
  components/                        layout (app shell, public layout), questions (cards, answers, AI panel,
                                     report dialog…), admin charts, Markdown, shared states
  pages/public|student|shared|teacher|admin/
  index.css                          design tokens (light/dark), Tailwind theme
tests/                               auth & guards, forms, ask-question flow, API client, utilities
```

## Design system

- Tokens in `src/index.css`: indigo primary (trust), teal `ai` accent used **only** for AI-generated content,
  semantic `success`/`warning`/`destructive`; separate dark-mode values. Chart series colour validated for contrast in
  both themes.
- Typography: Inter (text) and Plus Jakarta Sans (headings).
- Every data view has a loading skeleton, an empty state and an error state with retry; mutations give toast feedback.
- Accessibility: labelled form controls with `aria-invalid`/`aria-describedby`, keyboard-accessible Radix primitives,
  `prefers-reduced-motion` respected, chart data tables.

## Security notes

- The session token is an HttpOnly cookie – the SPA never stores or reads it.
- All requests are same-origin `/api` (Vite proxy locally, Vercel rewrite in production).
- Route guards are UX only; authorisation is enforced by the API.
- AI and user content is rendered with `react-markdown` (no raw HTML).
- `vercel.json` sets a strict CSP (no inline scripts), HSTS, frame denial and other headers.

## Deployment

Vercel project with **Root Directory = `frontend`**. Update the `/api` rewrite destination in `vercel.json` to your
Render URL. See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
