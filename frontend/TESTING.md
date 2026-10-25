# Frontend testing

The suite covers the **stable core** of the React app: the API client, auth
semantics, event-date partitioning and the two guards, plus two small UI
primitives and a login-form smoke test. Page-level layouts are deliberately out
of scope while their CSS/markup is being reworked.

## Stack

| Piece | Version | Why |
|-------|---------|-----|
| Vitest | 5.0.5 | Declares `vite: ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`; the app's Vite 8.3.1 stays as-is. |
| jsdom | 30 | Browser environment for React + portals + `localStorage`. |
| @testing-library/react | 16 | Behaviour-first rendering, React 19 ready. |
| @testing-library/user-event | 14 | Realistic focus/typing/keyboard. |
| @testing-library/jest-dom | 7 | Accessible assertions (`toHaveFocus`, `toBeInTheDocument`, …). |
| @vitest/coverage-v8 | 5 | Line/branch numbers without Istanbul instrumentation. |

**No fallback to `node:test` was needed.** Vitest 5 peer-resolves cleanly against
the existing Vite 8, and the React plugin used by the app (`@vitejs/plugin-react`
6) is reused by the test config. `vite.config.ts` is untouched; tests live in a
separate `vitest.config.ts`.

## Running

```bash
cd frontend
npm install          # once
npm test             # single run (≈3s, 96 tests)
npm run test:watch   # watch mode
npm run test:coverage
npx tsc --noEmit     # typecheck, test files included
```

`coverage/` is git-ignored. The HTML report opens at `coverage/index.html`.

## Files

```
frontend/
├── vitest.config.ts              test-only config (dev server config untouched)
└── src/
    ├── test/
    │   ├── setup.ts              jest-dom, cleanup, localStorage, media/timer reset
    │   ├── dom.ts                jsdom `matchMedia` stub with per-test overrides
    │   ├── fixtures.ts           makeUser, mocked Response, stubFetch
    │   └── render.tsx            renderWithRouter helper
    ├── services/api.test.ts
    ├── context/isProfileComplete.test.ts
    ├── context/AuthContext.test.tsx
    ├── eventDate.test.ts
    ├── components/ProtectedRoute.test.tsx
    ├── components/ui/Tooltip.test.tsx
    ├── components/ui/ChromeContext.test.tsx
    └── pages/Auth/Login.test.tsx
```

Conventions used throughout:

- **No network.** `stubFetch()` installs a per-test `fetch`; the setup file
  restores all globals/env after every test.
- **No DOM snapshots.** Assertions target roles, accessible names, labelled
  fields and observable state.
- **No sleeps.** Delays use fake timers (`Tooltip` hover, `useLocalDay` midnight).
- Tests render at most a small route tree; page components that are still being
  restyled are not imported.

## What is covered

| Area | Tests |
|------|-------|
| `services/api.ts` | URL building, `VITE_API_URL` trailing-slash normalisation, `Authorization` only with a stored `cnp_auth_token`, JSON vs `FormData` Content-Type, object serialisation, typed success parse, `ApiError` status/payload, status-specific fallback messages, non-JSON error bodies, network rejection wrapped as `ApiError` (status 0), 401 token behaviour, `getStoredToken`. |
| `isProfileComplete` | Missing user, student's five fields, whitespace-only values, `semester: 0`, string semester, staff roles exempt from `universityId`/`semester`, staff still needing name/department/phone. |
| `AuthProvider` / `useAuth` | Bootstrap with no token (no API call), restore via `/auth/me`, invalid stored token removed, success-without-user payload, `login`, `logout` (local state + token + API call), `updateUser`, hook outside provider throws. |
| `eventDate.ts` | `isEventPast` (null/empty/invalid, day granularity, Date vs ISO), `partitionEvents` (empty, upcoming ascending / past descending, today boundary at 00:00 and 23:59, `date` alias, input not mutated, dateless events), `localDayStartIso` local midnight round-trip, `useLocalDay` rollover at midnight. |
| Guards | `ProtectedRoute` loading / redirect to `/login` with `from` state / outlet; `RoleProtectedRoute` loading / redirect / 403 for a disallowed role / outlet for an allowed role. |
| `Tooltip` | Immediate open on focus, hover delay boundary (279 ms closed, 280 ms open), no hover on touch (`hover: none`) but focus still opens, close on mouse-leave/blur/Escape, focus retained, `aria-describedby` wired while open and absent when closed, existing `aria-describedby` preserved, disabled and empty-label no-ops. |
| `ChromeContext` | `useChrome` outside provider throws, overlay mutual exclusion and independent close, contributed commands registered and removed on unmount. |
| `Login` | Labelled fields, password visibility toggle, submit posts trimmed credentials to `/auth/login`, complete student → `/dashboard`, incomplete student → `/profile`, remembered `from` destination, API error rendered in `role="alert"` with `aria-describedby`, status fallback message, empty-field validation without a request. |

## Behaviour locked in (read before “fixing” it)

These are asserted as **current, actual** semantics — not necessarily desired
semantics:

1. `api()` does **not** clear `cnp_auth_token` on a 401. Only `AuthProvider`'s
   bootstrap clears it (on `/auth/me` failure). A mid-session 401 leaves a stale
   token in `localStorage` until `logout()`.
2. `api()` sends `Content-Type: application/json` even on a bodyless GET.
3. `isProfileComplete` uses truthiness, so `semester: 0` counts as missing and a
   non-empty string semester counts as present.
4. `partitionEvents` puts events with a missing or invalid date in **upcoming**
   (with a `NaN` comparator), where they stay forever.
5. `RoleProtectedRoute` renders an inline "403 Forbidden" block instead of
   redirecting.
6. `Tooltip`'s trigger only has `aria-describedby` while the tip is open.

## Deliberately not covered

- **Page surfaces** (`Clubs`, `Projects`, `Events`, `Profile`, the five
  dashboards, inventory/material requests) — their markup and CSS are changing
  under a concurrent restyle. Their data hooks and the shell are equally
  untouched for now.
- **`Register`, `Landing`, `AppLayout`, `Sidebar`, `Header`** — mostly presentational
  at this stage; covered indirectly only via the guards.
- **`CommandPalette` / `Shortcuts` internals** — mocked at the `ChromeContext`
  boundary. Their palette search, recents cache and keyboard model deserve a
  dedicated suite once stable.
- **`LoadingScreen` animation choreography** — only its `role="status"` /
  accessible name is asserted, not tick timing.
- **Backend, real HTTP, visual regression, CSS.**
- No test was skipped: `npm test` runs 96/96 green.

## Coverage

`npm run test:coverage` (target files only; page CSS/markup excluded by design):

```
All files          |   95.25 |     87.3 |   90.14 |   98.06 |
 src/eventDate.ts  |     100 |      100 |     100 |     100 |
 ProtectedRoute.tsx|     100 |      100 |     100 |     100 |
 ChromeContext.tsx |     100 |      100 |     100 |     100 |
 AuthContext.tsx   |     100 |      100 |   88.88 |     100 |
 services/api.ts   |     100 |    95.45 |     100 |     100 |
 Tooltip.tsx       |      93 |    84.61 |   95.23 |   98.85 |
 Login.tsx         |   86.53 |    75.47 |   64.28 |   91.48 |
```

Statements 281/295 · Branches 165/189 · Functions 64/71 · Lines 254/259.
The uncovered `Login` remainder is the rotating story panel (interval, hover
pause, slide buttons); `Tooltip`'s gap is the object-form ref forwarding branch.

## Typechecking

Test files live under `src/`, so the app's `tsconfig.json` (`include: ["src"]`)
typechecks them: `npx tsc --noEmit` is clean. `vitest.config.ts` sits beside
`vite.config.ts` and is intentionally outside that include, exactly like the
Vite config itself.

## Bugs and observations found by the suite

No test is red and nothing was changed in application source. The suite did
surface these:

1. **Stale token after a 401 (low).** `services/api.ts` throws `ApiError(401)` and
   leaves `cnp_auth_token` in place. Only `AuthProvider`'s bootstrap clears it,
   so an expiry during a session is not recovered until navigation triggers a
   failed `/auth/me` or the user signs out. Fixing this belongs in the client
   (or a shared 401 interceptor), not in a test.
2. **Dateless events never become past (medium, UI logic).** `partitionEvents`
   treats a missing/invalid `eventDate` as "not past", so such events sit in
   Upcoming indefinitely and sort against `NaN`. Currently only observable if an
   API record has no date; an explicit `isEventPast` guard or a "no date" bucket
   would be safer.
3. **Preflight on every cross-origin GET (observation).** Setting
   `Content-Type: application/json` on bodyless requests makes them non-simple
   requests. Harmless in dev, one extra OPTIONS round trip in production.
4. **`semester` accepts a string (observation).** `User.semester` is typed
   `number`, but `isProfileComplete` accepts `"4"`. The API has sent strings;
   the type or the check should be aligned eventually.

## Next three tests after the polish settles

1. **`useStudentDashboardData`** against stubbed endpoints — it composes counts
   and lists for the student dashboard and is the highest-risk derived-data
   surface.
2. **App-level role routing** (`AuthGuard` + `ProtectedRoute` +
   `RoleProtectedRoute` together) for all five roles, including the
   incomplete-profile redirect to `/profile`.
3. **`CommandPalette` / `Shortcuts`** — keyboard open, filtering, recents in
   `localStorage`, and command execution after close, now that the context
   boundary is already covered.
