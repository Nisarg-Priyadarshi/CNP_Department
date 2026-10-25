# Backend test suite

Automated tests for the CNP Department API. They lock down the **HTTP contract**
(status codes, response envelopes, field names the frontend reads) and the
**security invariants** (role gates, ownership, profile completeness, stock
arithmetic, notification recipients), so feature work in `backend/src/**` cannot
silently regress them.

## Quick start

```bash
cd backend
npm install          # one-off
npm test             # run the suite (~30s)
npm run test:watch   # TDD loop
npm run test:coverage
```

No real MongoDB, no `.env`, no running server and no Cloudinary account are
needed. Tests never touch a developer database: `MONGODB_URI` is deleted in the
test setup.

## Stack and why

| Piece | Choice | Reason |
|---|---|---|
| Runner | **Vitest 5** | The backend is native ESM (`"type": "module"`). Vitest runs the real module graph with no transform layer; Jest would need `--experimental-vm-modules` plus per-file wiring. Built-in V8 coverage. |
| HTTP | **Supertest 7** | Drives the real Express app/route stack in-process — no port, no sockets. |
| Database | **mongodb-memory-server 11** | Real `mongod` per run: real indexes (`unique` constraints), real aggregation pipelines (`$lookup`, `$group`) and real `findOneAndUpdate` semantics. Stubbing Mongo would hide exactly the bugs these tests look for. |
| Coverage | `@vitest/coverage-v8` | `npm run test:coverage` → `backend/coverage/index.html` + `lcov`. |

The first run downloads a `mongod` binary (~80 MB, cached in
`~/.cache/mongodb-binaries`). Every run after that is offline.

## How isolation works

- `tests/globalSetup.js` boots **one** in-memory MongoDB for the whole run and
  publishes its URI (env var + temp file, because workers are forked after
  global setup).
- `tests/helpers/db.js` → `useTestDB()` gives **each test file its own
  database** and wipes every collection **before each test**. Models are
  `init()`-ed so unique indexes exist exactly like production.
- `tests/setup.js` sets `NODE_ENV=test`, `JWT_SECRET` and dummy Cloudinary
  credentials before any module is imported.
- No sleeps: the two fire-and-forget notification writes are awaited with
  `vi.waitFor`, everything else is `await supertest(...)`.

`vitest.config.js` pins `maxWorkers: 1` / `fileParallelism: false` so the
Mongoose connection and the in-memory server stay deterministic.

## Layout

```
tests/
├── globalSetup.js        one mongodb-memory-server per run
├── setup.js              test env vars (JWT_SECRET, NODE_ENV, Cloudinary stubs)
├── helpers/
│   ├── app.js            Express app factory + mount map (mirrors server.js)
│   ├── db.js             per-file DB, per-test wipe, teardown
│   ├── auth.js           tokenFor / authHeader / expired / foreign-secret tokens
│   └── fixtures.js       makeUser, makeClub, makeProject, makeTeamScenario, …
├── auth.test.js          register/login/me/logout, bad/expired/unknown tokens
├── authorization.test.js full role matrix over every mutating route
├── profile.test.js       PROFILE_INCOMPLETE gate, profile update rules
├── clubs.test.js         club CRUD, coordinator, members, counts, leave
├── joinRequests.test.js  join → review → approve/reject, reviewer scoping
├── projects.test.js      project CRUD, membership, team leader, materials
├── mentors.test.js       mentor assign/primary/remove, mentor project list
├── events.test.js        event CRUD, /upcoming ordering, reminders idempotency
├── inventory.test.js     inventory CRUD, quantity arithmetic, delete guards
├── materialRequests.test.js  request → approve/reject + bulk, stock exactly once
├── notifications.test.js ownership, unread counts, cursor pagination, enrichment
├── updates.test.js       project updates + mentor feedback permissions
├── users.test.js         people pickers, dev helper, upload guards
├── dashboard.test.js     /api/dashboard/summary + /api/search
└── contracts.test.js     envelopes, error contract, pagination clamps, leaks
```

## The one piece of duplication (and the follow-up)

`backend/server.js` calls `app.listen()` at import time, so a test process
cannot import it without opening a real port and starting the reminder cron.

`tests/helpers/app.js` therefore rebuilds the app (same middleware, same route
mounts, same 404 fallback). **This list must stay in sync with `server.js`.**

> **Follow-up for the owner of `server.js`:** extract the Express app into
> `backend/app.js` (or export `app` before `startServer()` runs), have
> `server.js` import it, then delete the mount list from `tests/helpers/app.js`.
> `tests/contracts.test.js` hits every mount, so a missing route shows up as a
> 404, but a newly added route is only covered once it is mounted in both places.

## Coverage (current)

```
Statements   : 73.4% (2417/3294)
Branches     : 60.9% (1529/2510)
Functions    : 83.1%  (212/255)
Lines        : 74.1% (2338/3156)
```

`server.js` and `config/db.js` are excluded — they cannot be imported by tests
(process bootstrapping). Everything under `src/**` and `routes/**` counts.

Weakest files and why:

| File | Lines | Why |
|---|---|---|
| `src/services/cloudinaryService.js` | 0% | Uploads are never performed (no network / no account). Covered by contract only: routes reject bad files before upload. |
| `src/middleware/upload.js` | 52% | Only the "no file" and "unsupported type" branches; size limits and success paths need an upload. |
| `src/lib/http.js` | 61% | `monthRange`, `decodeCursor` error paths, `HttpError` and `boundedString` edges are exercised only where a route uses them. |
| `src/routes/notificationRoutes.js` | 65% | 500-line legacy enrichment fallbacks; the main link/actionText/metadata branches are now tested. |
| `src/routes/clubRoutes.js` | 70% | Logo/cover-image upload routes (Cloudinary). |
| `src/routes/eventRoutes.js` | 71% | Related-document upload/remove paths (Cloudinary). |
| `src/routes/userRoutes.js` | 66% | Profile-image success path (Cloudinary). |

## Bugs found while writing this suite

Reported, **not fixed here** (`backend/src/**` is owned by another agent):

1. **`PATCH /api/join-requests/:requestId/reject` returns a stale status.**
   Route: `src/routes/joinRequestRoutes.js` — the handler loads the request,
   then flips the status with `findOneAndUpdate(...)`, but answers with the
   document it loaded **before** the update.
   - Request: `PATCH /api/join-requests/<pendingId>/reject` as the assigned
     coordinator (or club_admin).
   - Expected: `200 { data: { status: 'rejected' } }`.
   - Actual: `200 { data: { status: 'pending' } }` (the DB row is correctly
     `rejected`; only the response body is wrong, so a client that trusts the
     response shows the request as still pending).
   - Covered by the skipped test
     `joinRequests.test.js → returns the rejected status in the response body`.
     Unskip it when fixed.

2. **Deleting a project update with attachments never deletes the files.**
   Route: `src/routes/projectUpdateRoutes.js` — the DELETE handler calls
   `deleteAsset(file.publicId, …)` but the file only imports
   `{ uploadImage, uploadRaw }` from `cloudinaryService.js`. The resulting
   `ReferenceError` is swallowed by the route's own `try/catch`, so the API
   answers `200` and deletes the Mongo row, but the Cloudinary asset is
   orphaned (silent storage leak).
   - Request: `DELETE /api/projects/<id>/updates/<updateWithFiles>` as the author.
   - Expected: `200`, asset destroyed on Cloudinary.
   - Actual: `200`, asset left behind, `console.error('Failed to delete asset …')`.
   - The HTTP contract test (`updates.test.js`) passes; the leak is not
     observable without stubbing Cloudinary. Fix by importing `deleteAsset`.

3. **Malformed JSON bodies answer HTML, not the JSON envelope.**
   `POST /api/auth/login` with `Content-Type: application/json` and invalid JSON
   returns `400` (correct status) with Express's default HTML error page,
   because neither `server.js` nor the routers install a JSON body-parser error
   handler. Every other error path is `{ success, message }`.
   - Expected: `400 { success: false, message: '…' }`.
   - Actual: `400` + `text/html`.
   - Asserted as status-only in `contracts.test.js`; fix by adding a 4-argument
   error middleware after `express.json()`.

Also observed transiently during the concurrent refactor of `src/**` (already
fixed upstream, now guarded): `POST /api/material-requests` returned `500`
because `isWholeNumber` was referenced before it was imported, and
`POST /api/projects/:id/materials` accepted fractional quantities. Both now have
tests.

## Skipped tests

Exactly one, and only because it asserts a bug above:

- `tests/joinRequests.test.js → club join request review → returns the rejected
  status in the response body` (bug 1).

## What is covered

- **Auth:** register/login/me/logout, wrong password (generic 401), missing /
  malformed / expired / foreign-secret / deleted-user tokens, duplicate email,
  password length, role whitelist, password never serialised.
- **Authorization:** a per-role matrix (student, faculty_coordinator,
  faculty_mentor, club_admin, project_admin) across every mutating route:
  clubs (create/edit/coordinator/members/join), projects (create/edit/status/
  members/team-leader/join), mentor assignment, events, inventory, material
  requests (single + bulk), join requests, project materials/updates/feedback,
  user directory. Plus resource-scoped checks: a coordinator can only act on
  their own club, only the primary mentor can approve project requests, students
  cannot approve anything, only project_admin touches inventory/material
  requests.
- **Profile completeness:** incomplete students can read and update their
  profile but every other mutation is `403 PROFILE_INCOMPLETE`; completing
  `universityId`/`semester` unlocks mutations; the gate also applies to
  non-student roles missing `department`/`phone`; `role` cannot be escalated
  through `PATCH /users/profile`.
- **Club workflow:** create → join request (coordinator required, no duplicates)
  → reviewer queue → approve (membership created once, student notified, counts
  correct) / reject → leave; member add/update/remove; duplicate membership 409;
  coordinator assignment validation.
- **Project workflow:** create → mentor assignment (auto-primary, switch, remove
  and auto-promote) → join request → approve → membership; team leader (must be
  a member, cannot be removed, cannot leave); materials (team-leader only,
  append-only, no `guitar` source).
- **Events:** CRUD permissions, `/upcoming` boundary + ascending order, club
  scope, past events retained, reminder processing is idempotent (once per
  event, never for past events, honours `reminderSkipped`).
- **Inventory & material requests:** create/update/restock, never negative,
  delete blocked when allocations or pending requests exist; request → approve
  decrements stock **exactly once**, creates the project material and the
  allocation, second approve is 409, insufficient stock leaves the request
  pending, requester must still be team leader; reject requires a reason and
  does not touch stock; bulk approve/reject are all-or-nothing (422).
- **Notifications:** ownership (cannot read/mark another user's row), unread
  count, mark read / unread / read-all, limit clamp (100), cursor pagination,
  type/kind/status filters, supported event types and recipients (join requests,
  approvals/rejections, mentor assignment, project updates, feedback, material
  add/approve/reject, event creation/reminder).
- **Contracts:** `{ success, count, data[] }` list envelopes, single-resource
  `data` shapes, no `password` anywhere, JSON 404, 401 envelope, 403 envelope,
  400 for malformed ObjectIds (never 500), 404 for unknown ids, pagination
  clamps.
- **Aggregates:** `/api/dashboard/summary` and `/api/search` shapes and scoping.

## What I would test next

1. **Cloudinary boundary** — extract the upload/delete calls behind an injected
   client and assert: folder per surface, old asset deleted on replace, update
   with attachments destroys its files (would catch bug 2 and the club/event
   upload branches, currently the biggest coverage hole).
2. **Concurrency** — two parallel approvals of the same join request / material
   request, two parallel duplicate joins. The routes are written for this
   (`findOneAndUpdate` claims, partial unique indexes) but only the sequential
   path is asserted. `Promise.all` against the same request id is cheap.
3. **Event reminder service unit tests** — `calculateReminderScheduledFor`,
   `shouldSkipReminder`, `buildEventReminderMessage` with fixed clocks
   (`vi.setSystemTime`), including the <24 h skip rule.
4. **Notification enrichment matrix** — one case per `NOTIFICATION_TYPES` value
   (the file has 17 types; 4 are covered) asserting link/actionText/metadata, so
   a new type cannot ship a dead inbox row.
5. **`GET /api/events` windowing/pagination** — it is still unbounded and
   returns every event; assert the cap once the feature agent adds one
   (`docs/backend-mocks.md` §3 asks for it).
6. **`POST /api/users/test` in production mode** — boot a second app with
   `NODE_ENV=production` and assert the dev route is a 404 (currently only the
   enabled branch is tested).
7. **Auth rate limiting / lockout** — none exists today; when it lands, test it
   here.
