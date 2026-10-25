# Backend changes — correctness, backlog implementation, performance

This pass upgrades the Express 5 + Mongoose 8 API behind the redesigned frontend. It has three
jobs: close correctness/security holes in the existing routes, implement the
[`docs/backend-mocks.md`](./backend-mocks.md) backlog additively, and stop the API doing avoidable
work. **No endpoint was removed, no response field was renamed, and no frontend file was touched.**

- Entry point: `backend/server.js` (port from `PORT`, dev default `5001`).
- Shared helpers added: `backend/src/lib/http.js` (query parsing, cursor, error mapping).
- New route files: `backend/src/routes/dashboardRoutes.js`, `backend/src/routes/searchRoutes.js`.
- Backfill script: `backend/scripts/backfill.mjs` (`node scripts/backfill.mjs`).
- Smoke script: `backend/scripts/smoke.mjs` (`node scripts/smoke.mjs`, server must be running).

---

## 1. Correctness bugs found and fixed

Everything here was reproduced or read from the code; nothing is speculative. “Impact” describes
what a real client (or a malicious one) could hit.

### 1.1 Crashes and error leakage

| Route | Symptom | Fix | Impact |
|---|---|---|---|
| 77 handlers across all route files | `catch` returned `res.status(500).json({ message: error.message })` | All now call `sendError(res, error)` (`src/lib/http.js`): CastError → 400, ValidationError → 400, duplicate key → 409, unknown → generic 500 + server log | Raw Mongo/CastError text no longer reaches clients; malformed ids stop producing fake 500s |
| `POST /api/clubs/:id/logo`, `…/cover_image` | Invalid `:id` → CastError → 500 | Explicit `isValidObjectId` → 400 | No 500 for a typo’d id |
| `GET /api/clubs/:clubId/members` | Invalid id → 500; message leaked CastError | 400 before the query | Same |
| `POST /api/clubs/:clubId/members` | Invalid `membershipType` → Mongoose ValidationError → **500** | Enum validated up front → 400 | A bad form value used to read as a server outage |
| `PATCH /api/clubs/:clubId/members/:studentId` | `membershipType: ""` slipped past `if (membershipType)` and failed schema validation → 500; `position` unbounded | Explicit enum + length check | Deterministic 400 |
| `DELETE /api/clubs/:clubId/members/:studentId` | Invalid ids → 500 | ObjectId guards | Same |
| `POST /api/projects` | Invalid `status` → ValidationError → 500 | Enum checked → 400 | Same |
| `PATCH /api/projects/:projectId/team-leader` | Invalid `projectId`/`studentId` → CastError → 500 | ObjectId guards → 400 | Same |
| `PUT /api/inventory/:itemId` | Empty `name` → ValidationError → 500; strings unbounded | Validation + caps → 400 | Same |
| `POST /api/inventory` | Fractional `totalQuantity` accepted | Whole-number validation | Stock can no longer be 2.5 units |
| `PATCH /api/inventory/:itemId/quantity` | Fractional amounts accepted; `action=set` could leave `availableQuantity > totalQuantity` | Whole-number check; available clamped to new total; `minimumStock` clamped | Impossible stock state removed |
| `GET /api/projects/:projectId/updates/:updateId` | If the project document was removed, `update.projectId._id` threw TypeError → 500 | Optional chaining | Orphaned update no longer crashes the route |
| `POST /api/auth/login` (and every handler) | A POST with **no body** left `req.body` undefined in Express 5 → destructuring TypeError → 500 | Global `req.body = {}` normaliser after the parsers | All no-body requests now reach the handler’s own 400 |
| `server.js` | Malformed JSON or an oversized body fell through to Express’s default HTML error page (stack trace in dev) | JSON error middleware (`entity.parse.failed` → 400, `entity.too.large` → 413, MulterError → 400) | API always answers JSON |

### 1.2 Permission and integrity holes

| Route | Symptom | Fix | Impact |
|---|---|---|---|
| `POST /api/clubs` | `facultyCoordinatorId` accepted **any** user id (or an invalid id → 500). A club could be assigned to a student, which then silently blocks join requests (`POST /clubs/:id/join` requires a coordinator) | Id + existence + `role === 'faculty_coordinator'` checks, same rule `PATCH /:clubId/coordinator` already had | Removes a durable data-integrity trap |
| `PATCH /api/join-requests/:requestId/approve` | Check-then-create: two reviewers (or a double click) could both pass `status === 'pending'`, both create a membership, and the loser surfaced a duplicate-key 500. The request could also be “approved” twice | Atomic claim `findOneAndUpdate({_id, status:'pending'}, {status:'approved'})`; membership creation is idempotent (existing membership is reused, `E11000` treated as “already a member”); failed membership creation rolls the claim back | Exactly one membership, exactly one approval; second caller gets 409 |
| `PATCH /api/join-requests/:requestId/reject` | Same check-then-save race; a reject could overwrite an approval | Atomic `pending → rejected` claim; 409 when already processed | Impossible transitions blocked |
| `POST /api/clubs/:clubId/join`, `POST /api/projects/:projectId/join` | Check-then-create race allowed two pending requests for the same student+club/project | New **partial unique indexes** (`status: 'pending'`) on `JoinRequest`; duplicate key mapped to the existing 409 message | DB-level guarantee, not a best-effort check |
| `PATCH /api/material-requests/:requestId/approve` | The request was claimed (`approved`) and stock deducted, then `ProjectMaterial` / `InventoryAllocation` creation could fail → request approved with no allocation and stock gone | Both writes are wrapped: on failure the stock increment is restored, the request returns to `pending`, and a created material row is deleted | No half-approved requests |
| `DELETE /api/inventory/:itemId` | Deleted items even when `InventoryAllocation` rows or pending `MaterialRequest`s referenced them | 409 unless both counts are zero | No orphaned allocation/request references |
| `POST /api/material-requests` | `quantity: 1.5` passed (`Number(qty) >= 1`) and would deduct fractional stock | Whole-number validation | Stock stays integral |
| `POST /api/projects/:projectId/materials` | Same fractional quantity bug | Whole-number validation | Same |
| `PATCH /api/projects/:projectId/updates/:updateId` | `files` was an untyped `Array`; a client could store unbounded object graphs | Max 10 entries, each `{name?, url, publicId?, type?, size?}` with capped strings | Bounded document size, no arbitrary payload |
| `GET /api/join-requests/club/:clubId` | For `club_admin`, a non-existent club returned **200 with an empty list** | Club existence check → 404 | Correct 404 semantics |
| `GET /api/join-requests/project/:projectId` | Same for a missing project | Project existence check → 404 | Same |
| `PATCH /api/notifications/:notificationId/unread` (new) | — | Ownership is part of the query (`{_id, userId}`); not-found and not-yours both return 404 | No way to discover or mutate another user’s notification |

Audited and deliberately **not** changed (see §5): `club_admin` and `project_admin` are
department-wide roles; team-leader checks already read `project.teamLeaderId` (not the role);
mentor approval already requires the **primary** `ProjectMentor`; no route accepts a user id from
the body when it should come from the JWT.

### 1.3 Validation / consistency (no crash, wrong answer)

| Route | Symptom | Fix |
|---|---|---|
| `POST /api/clubs` | `images` was untyped (`[Mixed]`) and unbounded | ≤ 20 URL strings, each ≤ 2048 chars, stored as strings (same shape the UI reads) |
| `POST /api/clubs` | Unbounded `name` / `description` | 120 / 4000 chars |
| `PATCH /api/clubs/:clubId` | Unbounded name/description; could not set `foundedAt` | Caps + `foundedAt` parsing |
| `POST /api/projects`, `PATCH /api/projects/:projectId` | Unbounded name/description | 120 / 4000 chars |
| `POST /api/material-requests` | Unbounded `reason` / `specifications` | 2000 chars each |
| `PATCH /api/material-requests/:id/reject`, bulk reject | Unbounded `rejectionReason` | 2000 chars |
| `POST /api/projects/:projectId/feedback` | Unbounded `feedbackText` | 4000 chars |
| `PATCH /api/users/profile` | Unbounded strings; `semester` could be `NaN`/999 | 120/120/50/30/1000/50 caps, semester 1–12 |
| `POST /api/users/test` (dev) | Invalid role → 500; email not normalised | Role enum + email format + lowercase/trim |
| `POST /api/auth/register` | No email format check; unbounded name/password/fields; every role self-selectable | Email regex, 120/200/120/50/30/1000 caps, `REGISTRATION_ROLES` allow-list (default: all five, so the UI is unchanged) |
| `GET /api/events` | `?from=nope` silently ignored the bound | 400 for invalid `from`/`to`/`month`, and `from > to` rejected |
| `GET /api/notifications` | `limit` capped but no validation; no stable cursor | Status/type/kind filters, malformed cursor → 400, stable `createdAt + _id` ordering |
| `GET /api/clubs/:clubId/members` | No `sort` validation | `sort=role|name|joined` only |

---

## 2. Endpoints added or extended

All are additive. Existing callers keep working: same paths, same `data` arrays, same
`{ success, count, data }` envelope. New summaries answer `{ success, data: { … } }`.

### 2.1 New endpoints

| Method & path | Who may call | Params / body | Response |
|---|---|---|---|
| `GET /api/clubs/summary` | any authenticated | — | `data: { clubs, members, coreTeam, coordinators, pendingRequests }` |
| `GET /api/clubs/:clubId` | any authenticated | — | `data: club` + `memberCount`, `totalMembers`, `coreTeamCount`, `regularMemberCount`, `pendingRequestCount`, `myMembership` |
| `DELETE /api/clubs/:clubId/join` | student (self) | — | `{ success, message }`; 409 if the caller is `core_team`; 404 if not a member |
| `GET /api/projects/summary` | any authenticated | — | `data: { projects, byStatus:{active,completed,inactive}, students, leaders, pendingJoinRequests, mine:{leading,member,mentor} }` |
| `DELETE /api/projects/:projectId/join` | student (self) | — | `{ success, message }`; 409 if the caller is the Team Leader |
| `GET /api/events/summary` | any authenticated | `month=YYYY-MM` | `data: { total, upcoming, byClub:[{ clubId, name, count }] }` |
| `PATCH /api/notifications/:notificationId/unread` | owner | — | `data: notification` |
| `GET /api/inventory/summary` | any authenticated | — | `data: { items, unitsTotal, unitsAvailable, unitsOnLoan, lowStock }` |
| `GET /api/material-requests/summary` | project_admin | — | `data: { pending, approved, rejected, unitsPending, oldestPendingAt, resolved }` |
| `POST /api/material-requests/bulk-approve` | project_admin | `{ requestIds: string[] }` (≤100) | 200 `{ data:{ approved, results:[{request,material,allocation}] } }` or **422** `{ details:[{requestId,reason}] }` with **no writes** |
| `POST /api/material-requests/bulk-reject` | project_admin | `{ requestIds: string[], rejectionReason }` | 200 `{ data:{ rejected, requestIds } }` or 422 with details, no writes |
| `GET /api/dashboard/summary` | any authenticated | — | `data: { nextEvent, daysUntil, eventsAhead, clubs, projects, clubRoles[], projectRoles[], unread, pendingJoinRequests }` |
| `GET /api/search` | any authenticated | `q`, `limit` (≤10, default 5), `types=clubs,projects,events` | `data: { clubs[], projects[], events[] }`, items `{ id, name|title, subtitle, href }` |

### 2.2 Extended endpoints

| Method & path | New params / fields | Notes |
|---|---|---|
| `GET /api/clubs` | `q=`, `scope=joined\|all`, `page`, `limit`; each club gains `pendingRequestCount`, `myMembership` | `coordinatorId` semantics unchanged; `q` also matches the coordinator’s name |
| `GET /api/clubs/:clubId/members` | `q=`, `sort=role\|name\|joined`, cap 500 | Aggregation filters/sorts in Mongo (no full fetch + JS filter) |
| `GET /api/projects` | `q=`, `status=`, `mine=1`, `page`, `limit`; each project gains `memberCount`, `pendingJoinRequests`, `myRelation` (`leading\|member\|mentor\|none`) | `mine=1` = led, member or mentored |
| `GET /api/projects/:projectId` | + `memberCount`, `pendingJoinRequests`, `myRelation` | Same fields as the directory row |
| `GET /api/events` | `clubId=`, `month=YYYY-MM`, `from=`, `to=`, `page`, `limit` | Sort unchanged (`eventDate` desc) |
| `GET /api/events/upcoming` | `clubId=`, `limit=` | Still returns today 00:00 onward unless `from` is supplied |
| `GET /api/notifications` | `type=`, `kind=`, `status=unread\|read\|all`, `limit`, `cursor`, `page`; response gains `hasMore`, `nextCursor` | `unreadCount`, `count`, `data` unchanged; ordering `createdAt desc, _id desc` |
| `GET /api/inventory` | `q=`, `category=` (case-insensitive exact), `page`, `limit`; items gain `minimumStock`, `lowStock` | `lowStock = minimumStock > 0 && availableQuantity <= minimumStock` |
| `POST /api/inventory`, `PUT /api/inventory/:itemId` | `minimumStock` | Must be 0…`totalQuantity` |
| `GET /api/material-requests` | `status=`, `projectId=`, `q=`, `page`, `limit` | `q` matches material name, reason, specifications, project name, requester name |
| `GET /api/join-requests/reviewer` | `status=pending\|approved\|rejected\|all`, cap 500 | Default stays `pending` |
| `GET /api/join-requests/club/:clubId`, `/project/:projectId` | `status=`, cap 500 | Missing club/project now 404 |
| `GET /api/join-requests/student` | `status=`, cap 500 | Default all (unchanged) |
| `GET /api/mentors/:mentorId/projects` | `:mentorId` accepts `me`; each `project` gains `memberCount` | Role checks unchanged |
| `GET /api/users/:userId/projects` | `:userId` accepts `me` | Same response |
| `GET /api/auth/me` | `data.completeness: { percent, missing[], complete }` | Same user fields |
| `POST /api/auth/register` | Optional `REGISTRATION_ROLES` env allow-list | Default all five (no behaviour change) |

### 2.3 Response-shape guarantees

- Lists still return `{ success: true, count, data: [...] }` (plus extra fields).
- The club membership roster still returns membership documents with a populated `studentId`
  object; `clubId` remains an id.
- `GET /notifications` still returns `unreadCount` and enriched rows (`link`, `actionText`,
  `metadata`) exactly as before.
- Summary endpoints use `data` as an object. No list endpoint was converted to an object.
- No endpoint gained a required parameter.

---

## 3. Schema changes and migration

| Model | Field | Type / default | Why |
|---|---|---|---|
| `GuitarInventory` | `minimumStock` | `Number`, default `0`, min `0` | Replaces the UI’s “low = under 25 % of own total” presentation rule with a real threshold. `0` means “no threshold configured” |
| `Club` | `foundedAt` | `Date`, default `null` | Club detail “Created” cell can show the founding date instead of the database row’s `createdAt` |
| `Notification` | `kind` | enum `club \| project \| event \| request \| system \| inventory`, default derived from `type` | Documented family for the inbox filter; `type` remains the precise, already-documented event name |

`Notification.kind` is derived on `validate` (and explicitly set by `notificationService` for
`insertMany`), so every existing creation path — including the seed — keeps working. The mapping:

| `type` | `kind` |
|---|---|
| `club_join_request`, `club_join_approved`, `club_join_rejected` | `club` |
| `project_join_*`, `mentor_assigned`, `project_update` | `project` |
| `material_request_*`, `material_request` | `request` |
| `material_added`, `project_material_added` | `inventory` |
| `event_created`, `event_reminder` | `event` |
| anything else | `system` |

**Migration.** New documents get defaults automatically; existing documents remain valid
(Mongoose defaults are not retroactive). Two fields need a one-time backfill:

```bash
cd backend
node scripts/backfill.mjs
```

The script is idempotent and only touches documents missing the field:

1. `Notification.kind` — set from `type` for every historical row (14 rows on the dev database).
2. `GuitarInventory.minimumStock` — set to `0` where absent (5 rows on dev).

`Club.foundedAt` is intentionally **not** backfilled: copying `createdAt` would repeat the exact
bug the field exists to fix (record creation is not founding). The UI should treat `null` as
“not recorded”. Queries use `$ifNull` so an un-backfilled item still behaves as `minimumStock: 0`.

Because `0` means “no threshold”, the backfill does not invent alert levels for historical items.
On the local development database the five seeded inventory items were given the same demo
thresholds as `seed.mjs` (25 / 5 / 8 / 6 / 10) so the low-stock UI has real values to display; this
is data configuration, not a code default.

**Seed data** (`backend/seed.mjs`): clubs now carry realistic `foundedAt` dates and each inventory
item carries a `minimumStock` roughly in line with its usage, so a fresh seed demonstrates the
low-stock summary. Existing seed values (users, memberships, requests, requests statuses) are
unchanged.

**Indexes created by Mongoose** (`autoIndex` on model init in dev). On a large production database,
build them in the background during a quiet window; do not let app startup block on them. The two
unique partial indexes will fail to build if an existing database already has duplicate pending
join requests — dedupe first:

```js
// one-off, review before running
db.joinrequests.aggregate([
  { $match: { status: 'pending' } },
  { $group: { _id: { s: '$studentId', c: '$clubId', p: '$projectId' }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
]);
```

---

## 4. Performance work

### 4.1 Indexes added (and why)

| Collection | Index | Serves |
|---|---|---|
| `ClubMembership` | `{ clubId: 1, joinedAt: 1 }` | club roster, counts, next-event/role joins |
| `ClubMembership` | `{ studentId: 1 }` | “my clubs”, dashboard roles, `scope=joined` |
| `ProjectMembership` | `{ projectId: 1 }` | roster, `memberCount` aggregate |
| `ProjectMentor` | `{ mentorId: 1 }`, `{ projectId: 1, isPrimary: 1 }` | mentor dashboard, primary-mentor resolution |
| `JoinRequest` | `uniq_pending_club_join_request` `{studentId,clubId}` unique, partial `{requestType:'club',status:'pending'}` | race-proof pending club requests |
| `JoinRequest` | `uniq_pending_project_join_request` `{studentId,projectId}` unique, partial `{requestType:'project',status:'pending'}` | race-proof pending project requests |
| `JoinRequest` | `{ status: 1, createdAt: -1 }` | global pending counts and queues |
| `JoinRequest` | `{ reviewerId: 1, status: 1, createdAt: -1 }` | reviewer queue |
| `JoinRequest` | `{ studentId: 1, createdAt: -1 }` | student request list |
| `JoinRequest` | `{ clubId: 1, status: 1 }`, `{ projectId: 1, status: 1 }` | per-club/per-project request panel + counts |
| `Notification` | `{ userId: 1, createdAt: -1, _id: -1 }` | inbox list and cursor pagination |
| `Notification` | `{ userId: 1, isRead: 1, createdAt: -1 }` (already existed) | unread count |
| `Event` | `{ eventDate: 1 }`, `{ clubId: 1, eventDate: 1 }` (already existed) | upcoming, month window, summary |
| `MaterialRequest` | `{ status: 1, createdAt: -1 }` | queue/summary |
| `MaterialRequest` | `{ projectId: 1, createdAt: -1 }` (already existed) | project request panel |
| `Project` | `{ status: 1 }`, `{ createdAt: -1 }` | directory filter and newest-first listing |
| `Club` | `{ facultyCoordinatorId: 1 }`, `{ createdAt: -1 }` | coordinator dashboards and directory sort |
| `User` | `{ role: 1, name: 1 }` (email already unique) | role dropdowns / people pickers |
| `GuitarInventory` | `{ category: 1 }`, `{ createdAt: -1 }` | category filter, list order |
| `InventoryAllocation` | `{ inventoryItemId: 1, allocatedAt: -1 }`, `{ projectId: 1, allocatedAt: -1 }` | allocation history panels |
| `ProjectMaterial` | `{ materialRequestId: 1 }` | idempotent approval lookup |

`EXPLAIN` on the dev database confirms the intended winners (`userId_1_createdAt_-1__id_-1`,
`clubId_1_joinedAt_1`, `status_1_createdAt_-1`, `status_1`, `eventDate_1`). The pre-existing
single-field `MaterialRequest.status_1` index is now redundant but was left in place (dropping
indexes is an operational decision, not an app-startup one).

### 4.2 N+1 and redundant work removed

| Before | After |
|---|---|
| `GET /clubs` did one membership aggregate (fine) but had no pending-request count; the UI did one `/clubs/:id/members` per club to learn its own role (documented N+1) | One memberships aggregate + one pending-request aggregate + one “my memberships” query for the whole list; `myMembership` on every club |
| `GET /projects` had no roster data; the UI called `/projects/:id/members` for every row | Three batch aggregates (`ProjectMembership`, `JoinRequest`, plus one `ProjectMentor` lookup for the caller) regardless of page size |
| `GET /mentors/:id/projects` had no `memberCount` | One `ProjectMembership` aggregate over all the mentor’s project ids |
| `GET /notifications` ran `enrichNotification` per row; each row could issue up to 3 queries (material request, material, join request) plus a `Project.findOne({teamLeaderId})` fallback | `buildEnrichmentContext()` preloads every referenced id with one `$in` query **per collection** for the page (5 collections max), plus one cached leader-project lookup. 100 rows ≈ 6 queries instead of ~200 |
| Lists used `find()` then filtered/sorted in JS (`members`, notifications) | Filtering/sorting/paging pushed into `find()`/`aggregate()` with `.skip/.limit` |
| Read-only handlers returned hydrated Mongoose documents | `.lean()` on directory, roster, notification, event, inventory, allocation, updates and join-request lists — no change-tracking overhead |
| Unbounded lists (clubs, projects, events, users, allocations, updates, roster) | Every list has a default limit (100–200) and a hard max (500). `GET /notifications` keeps its previous 50/100 cap |
| `GET /inventory/summary`, `/material-requests/summary`, `/clubs/summary`, `/projects/summary`, `/events/summary`, `/dashboard/summary` | Real `countDocuments` / `aggregate` with `$group` — no `find()` + `.length` |

`queryText()` also caps every `q` at 120 chars and `escapeRegex()` neutralises regex metacharacters
(no ReDoS / no accidental wildcard scans). All `sort` values that come from a query string are
allow-listed enums.

---

## 5. Decisions and trade-offs

1. **Additive only.** `data` arrays and the `{ success, count, data }` envelope were preserved;
   summaries put their object under `data`. No frontend change is required to keep the current
   screens working. `GET /notifications` additionally returns `hasMore`/`nextCursor`, which older
   clients ignore.
2. **No denormalised counters.** `memberCount`, `coreTeamCount`, `pendingRequestCount`,
   `pendingJoinRequests` are aggregation results, not stored counters. They cannot drift, and the
   collections are small (3 clubs / 3 projects). If they grow, the natural next step is a cached
   summary with invalidation, not a counter on every write path.
3. **`club_admin` and `project_admin` remain department-wide.** The seed has one of each, and the
   existing routes/comments define them as global administrators (they approve any club/project
   request). Introducing per-club ownership would silently break coordinator dashboards and the
   approval queue, so it would be a product decision, not a bug fix. Handler-level checks for
   **faculty coordinator** (assigned club only) and **faculty mentor** (primary mentor only) are
   enforced as before and were re-tested.
4. **No multi-document transactions.** The dev deployment can be a standalone MongoDB (no replica
   set), where `session.withTransaction` is unavailable. The approval workflows therefore use an
   atomic claim + compensating rollback, which is safe against double-submission and leaves a
   recoverable state on infrastructure failure. With a replica set, these could be wrapped in a
   transaction; see §6.
5. **Bulk approve is all-or-nothing.** Stock is validated against the **sum per inventory item**
   across the batch before any write; any problem returns 422 with every reason and changes nothing.
   This is stricter than “approve what you can”, and matches the backlog’s request.
6. **Cursor + offset both supported.** `cursor` is `base64url(createdAt|_id)` and is stable across
   same-millisecond rows; `page` is kept for callers that prefer offsets. Neither is required.
7. **Error text.** Unknown failures now return a generic 500; Mongoose validation messages remain
   (they are already user-facing and the UI shows them). The specific 403/409 business messages were
   preserved.
8. **`GET /clubs/:clubId` is new, not a replacement.** The list endpoint keeps returning full clubs
   (the UI reads the list), so adding a detail route does not change any existing call.
9. **Search uses escaped regex, not `$text`.** The palette needs substring matching while typing;
   Mongo text indexes require whole words. At the current scale (3 clubs / 3 projects / 5 events)
   a bounded regex with `limit(5)` is cheaper than maintaining text indexes. Revisit if directories
   grow past a few thousand rows.
10. **`GET /dashboard/summary` counts all upcoming events, not only the student’s clubs.** That is
    what `/events/upcoming` already returned for the dashboard; narrowing it would change what the
    student sees. `clubRoles`/`projectRoles` are the caller-scoped parts.
11. **`GET /auth/me` gained `completeness`** derived from the same predicate `requireAuth` uses, so
    the profile ring and the server’s “profile complete” gate can no longer disagree. It is additive.
12. **Left `/notifications/:id/read` returning 403 for another user’s notification** (the new
    `/unread` uses an owner-scoped query and returns 404). Changing the older route would alter an
    existing contract for no functional gain.

---

## 6. Known limitations and follow-ups

1. **Public registration still lets a visitor pick an administrator role.** The register screen
   exposes all five roles and changing that requires a frontend change (out of scope). Mitigation
   shipped: `REGISTRATION_ROLES` (see `.env.example`) narrows the server allow-list without a code
   change. Recommended production value: `REGISTRATION_ROLES=student`.
2. **`POST /api/users/test`** creates any user (including admins) with no auth in non-production.
   It is gated on `NODE_ENV === 'production'`; make sure production actually sets `NODE_ENV`.
3. **No login rate limiting / lockout.** Stateless JWT logout still cannot revoke a token. Both need
   infrastructure (rate-limit store / token blacklist) and were out of scope.
4. **Transactions.** Multi-document workflows (approval, bulk approval) use atomic claims +
   compensation. If the deployment is a replica set, wrap `executeBulkApproval` and the single
   approval workflow in a session transaction to remove the compensation window entirely.
5. **Enrichment fallbacks.** Legacy notifications with no `relatedId` (material approve/reject,
   mentor feedback) still need a lazy “latest for my project” lookup. It is cached per request, but
   a page full of such legacy rows costs one extra query per event type, not per row. Backfilling
   `relatedId` on old notifications would remove it.
6. **List caps.** Defaults are 100–200 with a hard max of 500. A directory larger than 500 needs
   pagination in the UI; `page`/`limit` are available.
7. **Regex search is not index-backed.** Fine at current size; see §5.9.
8. **`GET /api/events` exposes all events to every authenticated role** (unchanged). If events ever
   become club-private, this is the place to add scoping.
9. **`POST /api/events/reminders/process`** lets any `faculty_coordinator` trigger the global
   reminder sweep (it is idempotent and the scheduler also runs every minute). Consider restricting
   it to an ops role or a shared secret if it should not be user-triggerable.
10. **Inventory “on loan”** is computed as `unitsTotal - unitsAvailable`. Manual
    `PATCH /inventory/:id/quantity` adjustments can make it differ from the sum of allocation
    records; that is presentation, not corruption. A future pass could expose both numbers.
11. **Not implemented from the backlog** (deliberately): `club.featured` (needs a product rule),
    `project.teamCapacity` (no capacity field), `GET /notifications/summary` (time-series/type-share
    panel), `GET /join-requests/reviewer/summary` (age buckets), `Material.sourceCounts`, and a
    `project.approvalSummary` embedded object (the same numbers are available from
    `GET /material-requests/summary` + `?projectId=`). They remain documented in
    `docs/backend-mocks.md`; none was faked or partially shipped.

---

## 9. Fixes applied after the test suite landed

The backend test suite (see `backend/tests/README.md`) and the integration review found three
more defects. All are fixed, and the test that documented the first one is now un-skipped.

| Route / file | Symptom | Fix | Impact |
|---|---|---|---|
| `PATCH /api/join-requests/:id/reject` | Responded `200` with the document read **before** the update, so the client saw `status: "pending"` for a request it had just rejected (the database was correct). | Respond with the document returned by the atomic `findOneAndUpdate`. | The optimistic UI and any polling reader no longer disagree with the server. Covered by `tests/joinRequests.test.js`. |
| `src/routes/projectUpdateRoutes.js` | Deleting an update with attachments called `deleteAsset(...)` without importing it; the `ReferenceError` was swallowed by the route's own catch, so the API answered `200`, deleted the Mongo row and **never destroyed the Cloudinary asset**. | Imported `deleteAsset` from `cloudinaryService`; the call is now awaited with a per-asset fallback for unknown resource types. | No more orphaned uploads when an update is deleted. |
| `POST /api/auth/register` | The default allow-list was all five roles, because the old register screen offered them. Anyone could self-register as `club_admin` or `project_admin` — a direct privilege escalation. | The default is now **`student` only**. A deployment that needs open staff sign-up opts in explicitly with `REGISTRATION_ROLES=…`. | Registration no longer mints administrators. Staff accounts are provisioned by the department (seed data creates one of each). |

Malformed-JSON bodies were also re-checked: the `entity.parse.failed` middleware added in §1.1
answers a JSON `400` envelope, so the earlier "HTML error page" finding no longer reproduces.

### Consequence for the frontend

The register screen still renders a role picker. It is being reduced to a student sign-up with a
note that staff accounts are provisioned — otherwise the picker would advertise options the API now
correctly refuses. Until that lands, only `student` is accepted by the API.
