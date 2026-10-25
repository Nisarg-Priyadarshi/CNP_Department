# Backend wiring backlog

Everything the redesigned interface derives, filters or works around on the client, written
down so it can be moved into the API later. **No screen shows invented data** — every number
on every page is a length, a sum, a deduplication or a slice of a real response. What follows
is the list of places where the browser is doing work the server should eventually own.

Source of truth for each area: `docs/mocks/*.md` (one file per area, written by the team that
built it). Code that depends on a client-side rule carries a `// MOCK:` comment — grep it:

```bash
grep -rn "// MOCK:" frontend/src
```

How to read the tables: **today** is what the UI does now, **suggested** is the smallest
endpoint change that would let it stop.

---

## 0. Status — the API side is largely done

The backend pass implemented most of this backlog. The authoritative list of endpoints, fields
and response shapes is in **[`docs/backend-changes.md`](./backend-changes.md)**; this file keeps
tracking what the **client** still does for itself.

| Now available on the API | Replaces |
|---|---|
| `GET /clubs/summary`, `/projects/summary`, `/inventory/summary`, `/material-requests/summary`, `/events/summary`, `/dashboard/summary` | the client-side sums in §1 |
| `GET /clubs?scope=joined` + `myMembership` on each club | the club-membership N+1 in §2 |
| `GET /projects?mine=1` + `memberCount`, `myRelation`, `pendingJoinRequests` | the project-roster N+1 in §2 |
| `memberCount` on `GET /mentors/:id/projects` | the missing mentor team size in §2 |
| `q`, `status`, `scope`, `month`, `clubId`, `projectId`, `type`, `kind`, cursor/limit on every list | the client-side filters in §3 |
| `club.memberCount` / `coreTeamCount` / `pendingRequestCount` on `GET /clubs/:id`; `club.foundedAt` | the derived fields in §4 |
| `PATCH /notifications/:id/unread` | the missing verb in §5 |
| `DELETE /clubs/:id/join`, `DELETE /projects/:id/join` | the missing verbs in §5 |
| `POST /material-requests/bulk-approve` / `bulk-reject` | the client-loop in §5 |
| `GuitarInventory.minimumStock` | the 25 % heuristic in §5 |
| `GET /search?q=` | the shell's nav-only jump filter in §6 |
| `GET /auth/me → completeness` | the recomputed profile percentage in §4 |

**What that means for the UI:** anything still derived in §1–§6 is now a *choice*, not a
limitation, and should be moved as each page is touched. The tables below stay as written so the
gap is visible; an item is removed only when the page actually calls the endpoint.

### Moved to the API in the wiring pass

| Surface | Was | Now |
|---|---|---|
| Student dashboard clubs | `GET /clubs` + `GET /clubs/:id/members` **per club**, then a scan for the student's record | one `GET /clubs?scope=joined`; each club carries `myMembership` (`hooks/useStudentDashboardData.ts`) |
| Club board membership | derived from every roster | `club.myMembership`, with the roster scan kept only as a fallback (`pages/Clubs/Clubs.tsx`) |
| Club detail | `GET /clubs` then `.find(id)`, membership scanned from the roster | `GET /clubs/:id` (one request, 404 from the API), membership from `myMembership` (`pages/Clubs/ClubDetails.tsx`) |
| Project relation + team size | re-derived from `teamLeaderId` and the per-project roster | `myRelation` and `memberCount` from `GET /projects` / `GET /projects/:id` (`pages/Projects/Projects.tsx`, `ProjectDetails.tsx`) |
| Low stock | 25 %-of-total heuristic on the client | `GuitarInventory.minimumStock`, set per item in the create/edit form (`pages/Inventory/Inventory.tsx`) |
| Notification read state | one-way: read, or read-all | two-way toggle in place, row and reading pane (`PATCH /notifications/:id/unread`) |
| Leaving a club / project | not offered anywhere — the API verb existed but no UI called it | `Leave club` / `Leave project` with an in-place confirm; core-team seats and team leaders are not offered the action because the API refuses them (`pages/Clubs/ClubDetails.tsx`, `pages/Projects/ProjectDetails.tsx`) |

Still deliberately client-side: the project roster N+1 (the board draws faces, so the roster is
the payload), the palette's cached full lists (it promises no per-keystroke network), and the
list filters on pages not yet touched — all listed below and each one a choice, not a gap.


---


## 1. Aggregates the pages currently compute themselves

These are the highest-value changes: they remove an N+1 or replace a client sum with a
server truth, and every one of them is already needed by more than one screen.

| Capability | Where it shows up | Today | Suggested |
|---|---|---|---|
| Dashboard summary for a student | `/dashboard` stat strip, next-up countdown | Sorted and diffed from `/events/upcoming`, `/notifications`, membership lists | `GET /students/me/summary` → `{ nextEvent, daysUntil, eventsAhead, clubRoles, projectRoles, unread }` |
| Clubs summary | `/clubs` head (`3 clubs · 10 members · 2 coordinators`), board footer | Summed over `GET /clubs` | `GET /clubs/summary` |
| Projects summary | `/projects` standing instrument, team leaders rail, status rail widths | Joined from `GET /projects` + per-project members | `GET /projects/summary` → counts + `mine: { leading, member, requesting }` |
| Inventory summary | `/inventory` stats, project-admin ops strip (`57 of 215 units on loan`) | Summed over `GET /inventory` | `GET /inventory/summary` → `{ items, unitsTotal, unitsOnLoan, lowStock }` |
| Material-request summary | `/material-requests` stats (`oldest waiting 2h`, units requested), project-admin queue | Derived from the request list | `GET /material-requests/summary` → `{ pending, unitsPending, oldestPendingAt, resolved }` |
| Events month summary | `/events` month panel meta, "Clubs this month" rail | Sliced from the full event list | `GET /events/summary?month=YYYY-MM` → counts per club and status |
| Coordinator review queue | Coordinator dashboard "Requests to review" | Merged from one `GET /join-requests/club/:id` per club, then sorted | `GET /join-requests/reviewer?status=pending` |

## 2. N+1 calls that should be one request

| Call pattern | Where | Today | Suggested |
|---|---|---|---|
| Club membership resolution | Student dashboard, `/clubs` "My clubs" | `GET /clubs/:id/members` **per club** to learn the student's role (documented in `AGENTS.md`) | `GET /clubs?scope=joined` returning `myMembership` on each club |
| Project roster + relation | `/projects` rows, "Students on teams" total | `GET /projects/:id/members` **per project** + `GET /join-requests/student` | `memberCount` and `myRelation` on each project in `GET /projects`, or `GET /projects?mine=1` |
| Team size for a mentor | Mentor dashboard rows (currently omitted) | Not available — `/mentors/:id/projects` has no member count | Add `memberCount` to the project object in that payload |

## 3. Filters and search

All of these work today, but the browser fetches the full list and narrows it.

| What | Where | Suggested |
|---|---|---|
| Club directory search (name, description, coordinator, department) | `/clubs` | `GET /clubs?q=` |
| "My clubs" filter | `/clubs` | `GET /clubs?scope=joined` |
| Member search and ordering inside a club | Club detail members panel | `GET /clubs/:id/members?q=&sort=role,name` |
| Project search, status filter (the status rail), status grouping | `/projects` | `GET /projects?status=&q=` |
| Project member / mentor ordering (leader first) | Project detail roster | Sort server-side, or accept client order |
| Event club filter and month window | `/events` | `GET /events?clubId=&month=YYYY-MM` |
| Past events for students | `/events` agenda | Students only receive `/events/upcoming`; let it accept a `from` in the past, or expose `GET /events?window=` |
| Notification type filter and unread list | `/notifications` | `GET /notifications?type=&status=unread&limit=&cursor=` |
| Inventory search and category filter | `/inventory` | `GET /inventory?q=&category=` |
| Material-request status / project / text filters | `/material-requests` | `GET /material-requests?status=&projectId=&q=` |

## 4. Fields the UI wants that the payload does not carry

| Field | Where it is wanted | Why | Suggested |
|---|---|---|---|
| `club.memberCount` / `coreTeamCount` on the **detail** endpoint | Club detail composition meter | `/clubs` returns them, `/clubs/:id` does not, so the page counts the member array | Add both counts to `GET /clubs/:id` |
| `club.pendingRequestCount` | Club rows (coordinator, club admin), "Needs review" | Grouped from the request list | Add to `GET /clubs` |
| `club.foundedAt` | Club detail "Created" cell | Currently uses `createdAt`, which is when the record was created, not when the club was founded | `foundedAt` if the department keeps one |
| `club.featured` | `/clubs` lead-club treatment | The page picks "newest club you belong to, else newest club" | A `featured` flag, or `GET /clubs?featured=1` |
| `project.myRelation` / `memberCount` | `/projects` beds (team stack, bed against the largest team, relation mark) | Needs a per-project roster call today; the bed's ceiling is the largest roster fetched | Include both, plus `teamCapacity`, in the directory payload |
| `project.pendingJoinRequests` | Project detail facts aside | Count lifted from the join-request panel's own fetch | Add the count to `GET /projects/:id` |
| `notifications.type` as a documented enum | Inbox type filter and kind labels | The UI infers a family from the free-text `type` string | Document `type` values, or add `kind` |
| `user.createdAt` | Profile "Member since" plate | Returned by Mongoose but absent from the `User` type and the docs | Add to the documented user payload and `frontend/src/types` |
| `user.completeness` | Profile strength strip (ring, "N of 5", missing marks) | Recomputed from the same predicate as `isProfileComplete()` | `GET /auth/me` → `{ completeness: { percent, missing[] } }` |
| `mentor project memberCount` | Mentor rows | Not in `/mentors/:id/projects` | See §2 |
| Material `sourceCounts` | Project materials coverage meter | Counted from rows | Optional aggregate |
| Material-request approval summary | Project detail aside coverage ring (`approved / total requests`) | Counted from the request rows the panel already fetches | `approvalSummary` on `GET /projects/:id` or the material-requests payload |
| Join-request age | Project detail request queue depth (oldest tick) | `now - createdAt`, presentation only | `waitingSince`, or keep as presentation |

## 5. Missing verbs

| Action | Where | Today | Suggested |
|---|---|---|---|
| Mark a notification **unread** | `/notifications` row tools | Not offered at all — there is no endpoint, and faking it locally would let a reload contradict the UI | `PATCH /notifications/:id/unread` |
| `minimumStock` on inventory items | `/inventory` "Running low" tag and stat | **A presentation policy**: an item is "low" under 25 % of its own `totalQuantity` (`LOW_STOCK_RATIO`). It never changes stock | Real `minimumStock` field returned by `GET /inventory` |
| Leave a club / leave a project | Club and project detail | No endpoint, so membership is shown, never toggled | `DELETE /clubs/:id/join`, `DELETE /projects/:id/join` |
| Bulk approve / reject material requests | `/material-requests` | Deliberately not added: it would be a client loop over the existing per-item endpoint | `POST /material-requests/bulk-approve` |

## 6. Shell and navigation

| What | Where | Today | Suggested |
|---|---|---|---|
| "Jump to" search (`/`) | App header | Filters the signed-in nav destinations client-side; there is no search index | `GET /search?q=&scope=shell`, later extended to clubs/projects/events by name |
| Breadcrumb parent on detail routes | Header (`Clubs / Club details`) | The route carries only an id; the shell will not fetch a record to label a crumb | A lightweight `name` in the detail response, or `GET /clubs/:id/summary` |
| Relative timestamps ("12m ago") | Notification popover and rows | Computed in the browser from `createdAt` | Not needed — presentation |

## 7. Presentation-only derivations (no API needed)

Recorded so nobody mistakes them for missing data: day grouping in the inbox and agenda,
relative day labels ("In 7 days"), monograms from names, sorting core-team-first, the events
"day count" chips, and every "N more" disclosure.

---

## What is deliberately not faked

- No placeholder records, names, counts or percentages anywhere.
- No invented progress/health scores: every meter plots two or more real counts and prints
  its legend.
- No fabricated activity feeds: the project timeline is the updates the API returns.
- No disabled/invented controls for capabilities that do not exist yet.
- Screenshots of empty/error states were produced with Puppeteer request interception only;
  no seed data was written and no mock response ships in the app.
