# Architecture

This document explains why the app is built the way it is, and where each decision stops working. Start with the README for what the project does and how it was verified.

## Scope

A single-tenant-per-account reading list over an existing REST API. The goal is a correct, small server-first front end: no client-side data fetching, no global state library, no component library.

Out of scope: pagination and search (the API returns the full list), token refresh (the API issues access tokens only), offline support, and optimistic UI.

## Request flow

```
Browser ──► proxy.ts ──► route (Server Components) ──► lib/api-client ──► Django Ninja API
   ▲            │                    │
   │            └ redirect only      └ reads the session cookie, attaches the Bearer token
   │
   └── forms post to Server Functions (actions/*) ──► lib/api-client ──► API
```

The browser only ever talks to this app. The API URL and the access token stay on the server.

## Rendering model

`cacheComponents` and `partialPrefetching` are enabled in `next.config.ts`. With Cache Components, reading runtime data (cookies, `searchParams`) outside a `<Suspense>` boundary blocks prerendering, so the route is split deliberately:

- **Static shell** (`app/dashboard/page.tsx`): page header, sign-out form and the create form. None of it depends on the visitor.
- **Streamed section** (`components/bookmark-section.tsx`): awaits `searchParams`, reads the cookie and calls the API. It sits inside `<Suspense>` with a skeleton fallback, so the shell is served immediately and the list streams in.

The list is **not** cached with `"use cache"`. It is authenticated, per-visitor data, and every API call is made with `cache: "no-store"` so nothing authenticated can be shared between visitors by accident. The build output marks `/dashboard` and `/login` as Partial Prerender for this reason: static parts, dynamic holes.

`/` is a plain redirect configured in `next.config.ts`, which avoids a page that exists only to redirect.

## Authentication and session

**Where the token lives.** The API returns a JWT. The login Server Function stores it in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). JavaScript in the browser cannot read it, so an XSS bug cannot exfiltrate it the way it could from `localStorage`.

**Cookie lifetime.** `lib/token-expiry.ts` reads the `exp` claim so the cookie does not outlive the token. It does not verify the signature, and it never decides whether a session is valid; it only sizes `Max-Age`. When `exp` is missing or unreadable the cookie lasts one hour.

**Three layers, each with one job:**

1. `proxy.ts` — an optimistic redirect. It checks that a cookie *exists* and sends anonymous visitors to `/login` and signed-in visitors away from `/login` and `/register`. It never validates the token, and it is not a security boundary.
2. Server Functions and data reads — each calls `requireSessionToken()` itself. A function that relies on the proxy having run is one refactor away from being callable without a session.
3. The API — the only party that verifies the signature and ownership. It returns 401 for a bad token and 404 for another account's bookmark, and the app treats both as final.

**A token the API rejects.** If the cookie is present but the API answers 401 (expired, revoked, or the API restarted with a new secret), the app cannot just redirect to `/login`: the proxy would see the cookie and bounce the visitor straight back to `/dashboard`, forever. Instead `redirectWhenSessionRejected()` sends the visitor to `/session/expired`, a route handler that deletes the cookie and redirects to `/login?reason=expired`. Cookies cannot be modified while a Server Component renders, which is why this is a route handler and not a function called from the page.

**Trade-off of streaming.** The 401 is discovered inside the streamed section, after the shell has been sent with status 200. The redirect therefore reaches the browser as a streamed redirect payload plus a `<meta http-equiv="refresh">` tag rather than as an HTTP 3xx. Browsers follow it, but a client that only looks at the status code sees 200. Redirects from Server Functions, and from the proxy, are real 3xx responses.

## Data access boundary

`lib/api-client.ts` is the only module that:

- knows the API's URL layout and the `Authorization: Bearer` scheme;
- knows the wire shape (`is_read`, `saved_at`, `full_name`) and translates it to the app's types in `fromWireBookmark` and in the request bodies;
- turns failures into one error type, `ApiRequestError(status, detail)`.

Failure handling follows what the API really returns. Handled errors carry `{"detail": "..."}`; Django Ninja's 422 validation errors carry a *list*, which the client collapses into one sentence instead of leaking the structure to the page. A network failure becomes a 503 with a fixed message, and a non-JSON body (a proxy's HTML error page) falls back to a status-only message. Connection details such as the API host never reach the rendered page.

The module imports `server-only`, so importing it from a client component fails at build time. Tests alias that import to an empty module.

## Mutations

Every mutation is a Server Function used as a form `action`:

- Forms work without JavaScript. Hidden inputs carry the bookmark id; the next read state is sent as a field.
- Forms that can fail (`sign in`, `register`, `create`) use `useActionState`. The function returns `{ error, values }`; the page re-renders with the message and with what the person typed, because React resets uncontrolled forms after an action.
- Toggle and delete treat a 404 as success: the bookmark was removed from another tab, and the refreshed list is the right outcome. Any other failure throws and is caught by `app/dashboard/error.tsx`.
- After a successful write the function calls `revalidatePath("/dashboard")`.

## Validation and untrusted data

Validation lives in `lib/validation.ts` as pure functions over `FormData`, so it is unit-testable. It is applied on the server regardless of the HTML attributes on the inputs, which only improve the experience.

The API stores whatever URL string it is given, so the app does not trust what it reads back either: `safeExternalHref` only turns `http` and `https` values into links, and a stored `javascript:` URL renders as plain text. External links carry `rel="noopener noreferrer"`.

CSRF: Server Functions are POST-only and Next.js compares the `Origin` header with the host; the cookie is `SameSite=Lax`. No additional CSRF token is implemented.

## Testing strategy

| Level | What it proves | What it cannot catch |
|---|---|---|
| Unit (`tests/validation`, `bookmark-filters`, `token-expiry`, `format-and-links`) | Pure logic: normalization, limits, filter parsing, expiry arithmetic, link safety | Anything involving Next.js |
| API client (`tests/api-client`) with a stubbed `fetch` | Wire mapping, headers, query building, error taxonomy | Differences between the stub and the real API |
| HTTP end to end (`scripts/verify-e2e.mjs`) against the production build and the mock | Proxy redirects, cookie flags, SSR with API data, filters, every mutation as a real form post, session expiry recovery, per-account isolation | Client-side behaviour; the real API |

The mock API is deliberately dumb and dependency-free. It reproduces the contract that was read from the real source: Bearer auth, `{"detail": ...}` errors, 201 on create, 204 on delete, 401 for an unknown token, 404 for another account's bookmark, 409 for a duplicate email, and 422 with a list for missing fields. Restarting it forgets all issued tokens, which is how the expired-session scenario is reproduced.

## Known limits

- The bookmark list is unbounded because the API has no pagination. A large list is rendered in full.
- Tag filtering is an exact match on one tag; there is no free-text search.
- There is no token refresh. When the token expires the visitor signs in again.
- The date shown is formatted in UTC so server and client agree; it is not localized to the visitor.
- Client-side behaviour was not tested in a browser (see the README).
