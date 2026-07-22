# DevArena — Authentication Frontend & Application Shell

The production foundation the rest of the app is built on: session handling,
routing, state, the API layer, and the chrome. Problem explorer, battle UI,
Monaco, voice, analytics and the AI panel are deliberately **out of scope**.

## Folder map

```
src/
  app/          providers.tsx (provider stack) · router.tsx (route table)
  components/   ui/ (atoms) · molecules/ · organisms/     ← atomic design
  contexts/     theme-provider · session-provider
  features/     auth/{schemas,components,guards}
  hooks/        use-auth · use-session-recovery · use-auto-logout · use-notify …
  layouts/      root · auth · app · public
  pages/        auth/* · dashboard · settings · errors/*
  services/     api-client (interceptors) · token-store · oauth
  store/        slices/{auth,user,theme,notification} · api/{base,auth}
  styles/       tokens.css (semantic dark/light ramp)
  types/ constants/ utils/ test/
```

## Session model

| Credential | Where it lives | Why |
|---|---|---|
| Access token | in-memory module closure | anything in `localStorage` is readable by any XSS payload |
| Refresh token | httpOnly cookie | JS cannot read it at all; survives reload for persistent login |

Auth status starts at `IDLE`, not `UNAUTHENTICATED`. On boot the app asks
`/auth/refresh` whether the cookie still identifies someone, and guards hold a
splash until that resolves — otherwise every reload would flash the login page
at a signed-in user.

`Remember me` **extends** the idle window rather than disabling auto-logout,
which is the honest reading of that checkbox on a shared machine.

## API layer

One axios instance with three isolated interceptors:

1. **Request** — attach the bearer token.
2. **401 → refresh once → replay.** Refresh is **single-flight**: when several
   requests 401 together, exactly one refresh goes out and the rest await it.
   Without this, rotating refresh tokens would reject all but one and log the
   user out spuriously. (`interceptors.test.ts` asserts `refreshCount === 1`.)
3. **Transient failure → bounded exponential backoff**, idempotent verbs only.
   A POST is never replayed — a double submit is worse than a visible failure.

RTK Query runs on top of this instance rather than `fetchBaseQuery`, so the auth
rules exist in exactly one place.

Errors are normalized once (`utils/error.ts`) into `{ status, code, message,
details, isNetworkError }`. Field-level `details` are mapped onto the offending
form input; anything else becomes a single banner.

## Routing

Three tiers, each with its own guard and chrome:

- **open** — landing, error screens
- **public-only** — auth screens; an already-signed-in visitor is redirected in
- **protected** — the app shell; unauthenticated visitors are redirected out,
  and the attempted path is stored so login returns them there

`ProtectedRoute` also takes `roles`, sending an under-privileged user to `/403`.
Signed-in pages are lazy — a first-time visitor shouldn't download the dashboard
to read a login form.

## Error handling

`401` refresh-and-retry · `403` forbidden page · `404` catch-all route ·
`500` server error page · offline banner driven by connectivity events ·
`ErrorBoundary` at root **and** nested inside the app layout, so a page crash
leaves the navigation usable instead of dead-ending the user. Boundaries reset
on navigation.

## Design

The brief pinned the direction (Linear / GitHub / Vercel), so: near-black canvas,
hairline borders, one violet accent, typography carrying the work. Tokens are
**semantic** (`canvas`/`surface`/`border`/`fg`/`accent`), so one set of class
names serves both themes and light mode is a real inversion rather than a washed
out dark theme.

The mono face is a **utility** face — labels, verdicts, ratings, status codes —
true to a coding platform and leaving the sans face free to stay quiet. The
signature is the auth panel's live match ticker: what DevArena actually is
(people beating each other at algorithms in real time) is more persuasive than a
stock illustration, and it costs one column of text.

## Accessibility floor

Skip link · visible focus rings everywhere · labelled fields wired with
`aria-describedby` + `aria-invalid` via one `FormField` contract · live regions
for toasts and status · `aria-current` on active nav · accurate accessible names
that state what a control *does* · full keyboard navigation (Radix supplies
roving focus and Escape handling for menus) · `prefers-reduced-motion` respected
in both CSS and Framer Motion.

## Tests — 55 in this module (72 total with collaboration)

- **slices** — session lifecycle, token kept out of Redux, theme cycling, toast cap
- **guards** — bootstrapping splash, redirects both directions, `returnTo`, role denial
- **login form** — validation, submission, server errors mapped to fields, password reveal
- **interceptors** — refresh-and-replay, single-flight, retry policy, verb safety, attempt ceiling
- **shell** — theme toggle, toaster lifecycle, error boundary recovery, button semantics

Interceptor tests swap the axios **adapter** rather than mocking axios, so the
real interceptor chain is what runs.

## Backend contract

Endpoints assumed to exist under `VITE_API_URL` (default `/api/v1`), each
returning `{ success, data }` or `{ success: false, error }`:

`POST /auth/login · /auth/register · /auth/logout · /auth/refresh ·
/auth/forgot-password · /auth/reset-password · /auth/verify-email ·
/auth/resend-verification · /auth/oauth/:provider · /auth/oauth/exchange`
and `GET /auth/me`.
