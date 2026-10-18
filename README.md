# Reading List — Next.js SSR dashboard

A server-rendered reading list built with **Next.js 16 (App Router, Cache Components)**, **React 19** and **TypeScript**. It is the web front end for the bookmarks API in [django-ninja-mongo-api](https://github.com/LacerdaTraderCode/django-ninja-mongo-api): sign in, save links with tags and notes, filter by tag or read state, mark items read, delete them.

The point of the project is the architecture around the page, not the page itself: where data is fetched, where the token lives, what runs on the server, and what is proven by tests versus by reading code. [`docs/architecture.md`](docs/architecture.md) explains each decision and its limits.

## What it demonstrates

- **Static shell + streamed content.** `/dashboard` and `/login` are Partial Prerender routes: the header and the create form ship as static HTML, the personalized list streams in behind `<Suspense>`.
- **Server Functions for every mutation.** Create, mark read/unread, delete, sign in, register and sign out are all `"use server"` functions. The browser never calls the API and never sees the access token.
- **Session handling in three layers.** A JWT in an `httpOnly` cookie; `proxy.ts` as an optimistic redirect only; each Server Function and data read checks the session itself. A dedicated route recovers from a token the API rejects without redirect loops.
- **A typed API boundary.** `lib/api-client.ts` is the only place that knows the wire format and the only place that maps `snake_case` to `camelCase`.
- **Progressive enhancement.** Forms work without JavaScript, which is also how the end-to-end verification drives the app.
- **Tests at three levels.** Unit tests, API-client contract tests with a stubbed `fetch`, and HTTP-level checks against the production build.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.4.0 (App Router, `cacheComponents`, `proxy.ts`), React 19.3.0 |
| Language | TypeScript 5.9.3, strict |
| Tests | Vitest 5.0.4 (with Vite 8.3.4, its peer dependency) |
| Lint | ESLint 9 with `eslint-config-next` |
| Styling | Plain CSS with custom properties, light and dark via `prefers-color-scheme`, system fonts (no web-font requests) |
| Backend | [django-ninja-mongo-api](https://github.com/LacerdaTraderCode/django-ninja-mongo-api) |

## Run it

Node 22 or newer.

```bash
npm install
npm run dev:mock   # stand-in API on http://127.0.0.1:8000 — demo@example.com / correct-horse
npm run dev        # http://localhost:3000
```

To use the real API, start `django-ninja-mongo-api` (it needs MongoDB; see its README) and point the app at it:

```bash
cp .env.example .env.local   # BOOKMARKS_API_URL=http://127.0.0.1:8000/api
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run dev:mock` | Mock API (`MOCK_API_PORT` changes the port) |
| `npm run verify:e2e` | Boots the mock API and the production build, then checks real HTTP behaviour. Run `npm run build` first. |

## Project layout

```
app/            routes (login, register, dashboard, session/expired), root layout, styles
actions/        Server Functions: auth-actions.ts, bookmark-actions.ts
components/     UI; server components except the two forms that use useActionState
lib/            api-client, session, validation, filters, formatting, token expiry
mock-api/       Node stand-in for the Django Ninja API (no dependencies)
scripts/        verify-e2e.mjs
tests/          Vitest suites
proxy.ts        optimistic auth redirect
docs/           architecture.md
```

## Verification

Everything below was produced by running the commands, not typed in.

**Unit and contract tests** (`npm test`):

```text
 ✓ tests/api-client.test.ts (18 tests) 57ms
 ✓ tests/validation.test.ts (19 tests) 62ms
 ✓ tests/bookmark-filters.test.ts (8 tests) 7ms
 ✓ tests/format-and-links.test.ts (8 tests) 6ms
 ✓ tests/token-expiry.test.ts (6 tests) 5ms
 Test Files  5 passed (5)
      Tests  59 passed (59)
```

**Production build** (`npm run build`), route table:

```text
Route (app)
┌ ○ /_not-found
├ ◐ /dashboard
├ ○ /icon.svg
├ ◐ /login
├ ○ /register
└ ƒ /session/expired


ƒ Proxy (Middleware)

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

**End-to-end checks** (`npm run verify:e2e`). The script drives the production build over plain HTTP — cookies, redirects and multipart form posts to Server Functions — against the mock API:

```text
PASS  anonymous visit to /dashboard is redirected to /login
PASS  / redirects to /dashboard
PASS  login page renders
PASS  register page renders
PASS  wrong password shows the API's message and keeps the typed email
PASS  malformed email is rejected before reaching the API
PASS  login redirects to /dashboard
PASS  session cookie is HttpOnly, SameSite=Lax and has a lifetime
PASS  signed-in visit to /login is redirected to /dashboard
PASS  dashboard renders the list on the server
PASS  dashboard lists exactly the four seeded bookmarks
PASS  the access token never appears in the HTML
PASS  external links carry rel=noopener noreferrer
PASS  tag filter lists matching bookmarks only
PASS  read filter lists read bookmarks only
PASS  tag and status filters combine
PASS  an empty filtered result explains itself
PASS  an unknown status value falls back to all bookmarks
PASS  an invalid URL is rejected with a message and the input is kept
PASS  a javascript: URL is refused
PASS  a created bookmark appears with normalized tags
PASS  marking a bookmark as read moves it into the read filter
PASS  marking it unread again moves it back
PASS  deleting a bookmark removes it
PASS  a forged cookie cannot mutate data: the API rejects it and the app sends the visitor to /session/expired
PASS  the forged request changed nothing
PASS  a mutation without any cookie is redirected to /login
PASS  registering an existing email shows the conflict message
PASS  a short password is rejected before reaching the API
PASS  a valid registration signs the new account in
PASS  a new account starts with an empty list
PASS  accounts do not see each other's bookmarks
PASS  sign out redirects to /login and clears the cookie
PASS  fresh login for the expired-session scenario
PASS  a token the API rejects sends the dashboard to /session/expired
PASS  /session/expired redirects to /login?reason=expired
PASS  /session/expired clears the stale cookie
PASS  the login page explains the expiry and does not loop back
PASS  an unreachable API does not leak connection details to the page
PASS  an unreachable API does not render bookmarks

40/40 checks passed
```

## What was not verified

- **The real API.** The app has never run against `django-ninja-mongo-api` with a live MongoDB. The mock in `mock-api/server.mjs` was written by reading that API's routers and schemas, so it can drift from the real service.
- **A browser.** None was available. Hydration, the pending state of `useActionState` forms, how React resets a form after a client-side submit, visual rendering, dark mode, the responsive layout and keyboard focus order were not exercised. The HTTP-level checks cover the no-JavaScript path.
- **The session check inside each Server Function, in isolation.** `proxy.ts` matches the same paths, so a request without a cookie is redirected before a Server Function runs. The forged-cookie scenario does exercise the API-rejection path; the in-function check itself is covered by reading the code, not by a request.
- **The GitHub Actions workflow.** `.github/workflows/ci.yml` runs the same commands as above on Node 22. The commands were run locally, including from a clean copy without a lockfile; the workflow itself is only as verified as its run history on the Actions tab.
- **`npm run dev` beyond a smoke test.** It was started and `/login` and the proxy redirect were checked; the full flow was verified on the production build.

## Dependency pinning

Direct dependencies are pinned to exact versions in `package.json` (`.npmrc` sets `save-exact`). There is **no `package-lock.json`** in the repository, so transitive dependencies resolve at install time.

`.npmrc` also sets `legacy-peer-deps=true`, and `vite` is declared explicitly. Without that, npm's resolver crashed on Vitest 5's peer set (`Cannot read properties of null (reading 'edgesOut')`), and with the flag alone Vitest could not find `vite`.

## License

MIT
