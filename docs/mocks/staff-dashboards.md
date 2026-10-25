# Staff dashboards — what is derived or held client-side

Area: `frontend/src/pages/Dashboard/*` (faculty coordinator, club admin, faculty mentor, project admin).
Nothing below invents a value: each row is computed from a payload the four screens already fetch.

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Join-request queue ordered oldest first | Coordinator — inbox | `/join-requests/club/:id` is fetched per club and merged; the merge is ordered by `createdAt` in the browser | `GET /join-requests/reviewer?status=pending&sort=createdAt` returns the reviewer's queue in order |
| Queue depth ruler and per-item age ticks | Coordinator — inbox | Depth is the merged pending queue capped at eight slots; each slot's tint is an age bucket over `createdAt`, and the oldest slip is featured | `GET /join-requests/reviewer/summary` returning `{ count, oldestAt, buckets }` |
| Core-team share per club ("2/3 core") | Coordinator — club rings | `/clubs?coordinatorId=` already returns `coreTeamCount` and `totalMembers`; the ratio is drawn as a ring | — (no new call needed) |
| Pending-request count per club | Coordinator and club admin — club tiles | Derived by grouping the merged pending requests by `clubId` | Include `pendingRequestCount` on `GET /clubs` |
| Fortnight occupancy strip | Coordinator — "Next" | The 14-day strip groups the `/events` payload by local calendar day and counts events per day | `GET /events?from=&to=` (and a per-club scope for coordinators) |
| Event scope | Coordinator and club admin — event rail | Both screens read the full `/events` payload, as before this pass; they are not filtered to the viewer's clubs | `GET /events?clubId=` or `/events?forUser=` |
| Coordinator coverage ring ("2/3 covered") | Club admin — coverage band | `withCoordinator / totalClubs`, both already computed in the dashboard | — |
| Programme roster bar (one block per club, width by members, hatched when unassigned) | Club admin — coverage band | Built from the member counts and `facultyCoordinatorId` already on `GET /clubs` | Include `memberCount` and `coordinator` on a summary endpoint if the list grows |
| Clubs without a coordinator, and request counts per club | Club admin — hatched slots and tally marks | Filter over `GET /clubs` on `facultyCoordinatorId`, plus `status === 'pending'` over `/join-requests/club/all` | `GET /clubs?unassigned=true` and a `pendingCount` on the club record |
| Portfolio status blocks (width by count) and status filter | Project admin — portfolio band | `GET /projects` returns every project; widths and the All/Active/Completed/Inactive filter are computed in memory | `GET /projects?status=active` and a `GET /projects/summary` for counts |
| Queue funnel stage counts (pending / approved / rejected) | Project admin — console and waiting panel | Materials come from the full `/material-requests` payload; project join stages come from the full `/join-requests/project/all` payload, which the dashboard now passes through unfiltered (the API call is unchanged, the page filters) | `GET /material-requests?status=` and `GET /join-requests/project/all?status=` returning stage counts |
| Teams without a leader | Project admin — console + leader gauge | `totalProjects - withTeamLeader`, both already derived in the dashboard | — |
| Units on loan ("57 of 215 units on loan") | Project admin — console, inventory head, capacity cells | Sum of `totalQuantity - availableQuantity` over `GET /inventory`; the endpoint has no aggregate | `GET /inventory/summary` returning `{ items, unitsTotal, unitsOnLoan }` |
| Inventory capacity cells | Project admin — inventory panel | One cell per item from `/inventory`, fill = available / total | Add pagination params to `/inventory` if the shelf grows |
| Last-activity rail under mentored projects | Mentor — project nodes | Uses the real `updatedAt` on each project document; the marker is its position in a 14-day window. The payload has no time series, so no sparkline is drawn | `GET /projects/:id/activity?days=30` if a real cadence series is wanted |
| Team leader on mentored projects | Mentor — orbit badge | `/mentors/:id/projects` returns the populated `teamLeaderId`; no member list, so the badge is one person, not a stack | Add `memberCount` / `members` to the project object in that payload |
| "Since 24 Oct" assignment date | Mentor — status band | Smallest `assignedAt` across the mentor's assignments | — |
| Unread notification count | All four screens — page head | Counts `isRead === false` over `GET /notifications` (same derivation the old dashboard used) | `GET /notifications/unread-count` already exists; the shell header uses it |

Notes

- No placeholder chart, fake number, disabled invented control or fabricated name is rendered anywhere on these four screens. Where a payload has only counts, the visual plots the proportion of those counts (rings, blocks, funnels, capacity cells) and the numbers stay in the accessible name.
- The event create/edit form is the existing `EventForm` component, embedded in the events panel; no events API call or guard was changed.
- The coordinator error state (`/clubs?coordinatorId=` failing) is preserved and shown as a `.ui-notice--error` with a retry.
- The loading state is now the role's own skeleton (`DashSkeleton` in `StaffBits.tsx`); the old full-screen `LoadingScreen` gate is gone. Data reloads keep the page mounted and rely on the shell's route rail.
