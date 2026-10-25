# Clubs — what is derived, filtered or mocked on the client

The club routes use the existing endpoints unchanged (`GET /clubs`, `GET /clubs/:id/members`,
`GET /clubs/:id/events`, `GET /join-requests/student`, `GET /join-requests/club/:id`,
`POST /clubs/:id/join`, `PATCH /join-requests/:id/approve|reject`, `POST /clubs/:id/members`,
`PATCH|DELETE /clubs/:id/members/:studentId`, `PATCH /clubs/:id`, `PATCH /clubs/:id/coordinator`,
`POST /clubs/:id/logo`, `POST /clubs/:id/cover_image`, `DELETE /events/:id`).

Everything below is computed from data those calls already return. Site-wide, the club membership
lookup is still the documented N+1 (`/clubs/:id/members` per club) — untouched, as instructed.

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Directory search (name, description, coordinator, department) | `/clubs` search field | `GET /clubs` takes no query parameters | `GET /clubs?q=` |
| **All / My clubs** filter and the "Your clubs" crest rail | `/clubs` filter + aside | The server returns every club, so the client compares against the membership map it already built | `GET /clubs?scope=joined` (or include `myMembership` on each club) |
| Featured (lead) club | Top of the `/clubs` board | No "featured"/"pinned" concept exists; the page uses the newest club the student belongs to, else the newest club by `createdAt` | `featured` flag on the club, or `GET /clubs?featured=1` |
| Member avatar stacks (lead plate and each ruled entry) | `/clubs` board | The directory already fetched each roster for the membership map; the same response now also feeds the stacks, so staff roles make the same per-club call students do. This widens the documented N+1 rather than adding a second pattern | `GET /clubs?include=rosterPreview&limit=8` — one list payload with the first N names per club |
| Coordinator → clubs grouping, per-coordinator club crests | `/clubs` aside "Coordinators" | Derived from the populated `facultyCoordinatorId` on the directory payload | `GET /clubs/coordinators` |
| Composition scales and the core-team ring (core vs members) | Lead plate, every ruled entry, club-page plate and "Core team" panel | `/clubs` returns `memberCount` / `coreTeamCount`; `/clubs/:id` returns neither, so the detail page counts the members array | Add `memberCount` / `coreTeamCount` to `GET /clubs/:id` |
| Coverage scale (clubs with a coordinator) | `/clubs` aside | `coveredClubs / clubs.length`, counted from the directory payload | `GET /clubs/summary` |
| Member search | Club page members panel (shown above 6 members) | `GET /clubs/:id/members` has no search parameter | `GET /clubs/:id/members?q=` |
| Member ordering (core team first, then name) | Club page members panel | The endpoint returns insertion order | Server-side sort, or accept the client order |
| Directory totals (clubs, members, core seats, coordinators) | `/clubs` index rail | Summed from `memberCount` / `coreTeamCount` and distinct coordinators in the directory payload | A `GET /clubs/summary` aggregate |
| "Created" date | Crest inspector on the club page | Uses `club.createdAt` as the creation date; there is no separate founded date | `foundedAt` if the department wants a real founding year |
| Pending request count on the toolbar | Club page toolbar | Derived from the filtered `/join-requests/club/:id` list | Include `pendingCount` on the club payload |

## Deliberately not mocked

- No placeholder clubs, members, events, coordinators or totals are shown. Every number is the
  length or sum of a real response.
- No invented activity series. The only visuals are composition (core / total), coverage
  (clubs with a coordinator) and the directory totals — each plots counts the API already returns.
- No disabled controls were added for features that do not exist.
