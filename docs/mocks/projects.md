# Projects — what is derived, filtered or mocked on the client

The projects routes use the existing endpoints unchanged: `GET /projects`,
`GET /mentors/:id/projects` (faculty mentors), `GET /projects/:id`, `GET /projects/:id/members`,
`GET /projects/:id/mentors`, `GET /join-requests/student`, `GET /join-requests/project/:id`,
`POST /projects/:id/join`, `PATCH /join-requests/:id/approve|reject`, `POST /projects`,
`PATCH /projects/:id`, `PATCH /projects/:id/status`, `POST /projects/:id/image`,
`POST|DELETE /projects/:id/members`, `PATCH /projects/:id/team-leader`,
`POST|DELETE /projects/:id/mentors`, `PATCH /projects/:id/mentors/:mentorId/primary`,
`GET|POST /projects/:id/updates`, `GET|POST /projects/:id/feedback`,
`GET|POST /projects/:id/materials`, `GET /inventory`, `GET|POST /material-requests/...`.
Every guard, validation and `window.confirm` is unchanged. The two optional callbacks that were
added (`ProjectMaterials.onSummaryChange`, `ProjectMaterialRequests.onStatsChange`) only lift
already-fetched counts to the page; they add no request.

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Status rail widths and per-cell counts | `/projects`, top of the board | The rail is the status distribution of the fetched projects (`count / total`), and each cell is also the status filter. `GET /projects` returns no aggregate | `statusCounts` on the directory payload, or `GET /projects/summary` |
| Team size and the student's relation (leader / member / request pending) per bed | `/projects` rows | `GET /projects` returns only `teamLeaderId`, not the roster; the page joins one `GET /projects/:id/members` per project plus `GET /join-requests/student` | Include `memberIds` / `memberCount` and `myRelation` on each project, or `GET /projects?mine=1` (`// MOCK:` in `Projects.tsx`) |
| Team bed ceiling | `/projects` rows | The bed is measured against the largest roster among the fetched projects; the API has no capacity or target team size. The accessible name states the ceiling so the bar is never read as a rule | `teamCapacity` per project, or an explicit product decision on a maximum |
| "Your standing" / "Portfolio" instrument | `/projects` aside | Leading, on-a-team, requesting and "with a leader" are counted over the fetched projects, the member map and the role from `AuthContext` | `GET /projects/summary` with a per-role block |
| "On teams" student stack | `/projects` aside foot | Unique students deduplicated across the per-project rosters | Aggregate endpoint |
| Roster count per project (N+1) | `/projects` rows and the aside total | Same per-project member calls; unique students are deduplicated client-side | `GET /projects/summary` or counts on the directory payload |
| Status filter (All / Active / Completed / Inactive) and search | `/projects` rail and page head | `GET /projects` accepts no query; filtering happens over the fetched list. Only statuses present in the data are offered, so a zero-result filter cannot happen | `GET /projects?status=active&q=` |
| "Completed" / "Inactive" group collapse | `/projects` board | The server returns all statuses in insertion order; the client groups them, active first, and remembers the disclosure state | Server-side ordering, or keep groups client-side |
| Project monogram (two letters) | Beds, identity plate, dashboard card | No logo field exists beyond the uploaded `image`; the monogram is derived from the project name when `image` is null | Keep as-is (a fallback, not data) |
| Material coverage ring | `/projects/:id` aside | Approved material requests over all material requests, counted from the rows `ProjectMaterialRequests` fetched. It is demand coverage, not a fabricated progress percentage, and its accessible name carries both numbers | `approvalSummary` on `GET /projects/:id` or on the material-requests payload |
| Join-request queue depth | `/projects/:id` join panel | Waiting time is `now - createdAt` per pending request; the track places the oldest at the left edge and "now" at the right, and the oldest tick is marked | `waitingSince` / `ageHours` per join request, or a queue summary |
| Material composition bar and source counts | `/projects/:id` Materials | The endpoint returns material rows with `source`; the bar and legend are counts per source | Optional `sourceCounts` aggregate |
| Update timeline order and the "latest" node | `/projects/:id` Updates | The API returns updates; the first row is marked as the latest | Server-side ordering, or keep as-is |
| Member and mentor ordering | Team and mentors panels | Team leader first, then alphabetical; mentors in assignment order | Server-side sort |

## Deliberately not mocked

- No placeholder projects, members, mentors, updates, materials or requests. Every number is a
  length, sum or deduplication of a real response.
- No invented progress bars, percentages or "health" scores. The team bed plots a roster against
  the largest roster and says so; the coverage ring plots approved requests against all requests;
  the material composition bar plots three real counts and its legend carries the numbers.
- The timeline is the updates the API returns; no synthetic entries, and no fabricated feedback.
