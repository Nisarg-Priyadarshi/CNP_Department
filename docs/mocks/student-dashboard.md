# Student dashboard — client-side values

The screen is now drawn as an instrument ("your term"): a six-week event strip, a
ticket for the next event, crests and status rails. Every mark is placed from the
five existing fetches — no number is invented. What the browser does that the
server could own:

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Term strip: a 6-week window from Monday, one day column per date, events placed on their day, the "now" column | `studentUtils.buildTermWindow` → `StudentTermStrip` | `/events/upcoming` returns a flat list of events with dates; the window, the day buckets, the density per day and the today marker are all placed in the browser | `GET /events/upcoming?from=&to=` returning a date-bucketed series, or `GET /students/me/term` → `{ start, end, days: [{ date, events }] }` |
| Events beyond the horizon ("+N" at the strip's right edge) | `StudentTermStrip` | Same list, filtered to `date > window.end` | Same endpoint; or `eventsLater` on the term payload |
| Countdown ring (closeness on a 14-day scale) | `studentUtils.closenessFor` → `StudentUpcomingEvents` | A display convention on a real day diff; the numeral is the real count | `GET /students/me/summary` returning `nextEvent` + `daysUntil` |
| Days to the next event (head mark "7 days") | `StudentDashboardPage`, `StudentDashboardHeader` | Diffs local calendar days against the sorted event list | Same summary endpoint |
| "3 events" / "3 ahead" | Term strip and next-up heads | Length of the upcoming-events payload (already future-scoped) | Same summary endpoint |
| "1 core" / "1 lead" region counts | Clubs and projects heads | Counts over `membership.membershipType` and `project.teamLeaderId === user._id` | Summary endpoint with role counts |
| Club composition bar (core vs regular) | `StudentMemberships` | `coreTeamCount ÷ totalMembers` from the `/clubs` payload; no ratio is returned | Include `composition` on each club, or accept the two counts |
| Project stage rail (1–3) | `studentUtils.projectStage` → `StudentProjects` | The payload carries a status word, not a pipeline position; the word is mapped to a fixed three-step rail | `stage` or `progress` on each project in `/users/:id/projects` |
| Pending join-request ids per project (warning flag) | `StudentDashboardPage` → `StudentProjects` | `/join-requests/student` is fetched whole and matched to project ids on the client | Include `requestStatus` on each project in `/users/:id/projects` |
| Inbox marks: one per notice with its read state, one per request with its status | `StudentNotificationSummary`, `StudentRequests` | Two lists, each already carrying `isRead` / `status`; the marks are a slice of up to six | `GET /students/me/summary` → `{ unread, notices: [...], requests: [...] }` |
| "2h ago" on notices | Tooltip in `StudentNotificationSummary` | Notifications return `createdAt` only | Optional: `createdLabel` (relative time is a display concern) |
| Oldest pending request age (tooltip) | `StudentRequests` | `min(createdAt)` over the pending list | `oldestPendingAt` on the summary endpoint |

## Unchanged, deliberately

- **The N+1.** `useStudentDashboardData.ts` lists every club and calls
  `GET /clubs/:id/members` per club to find the student's membership. That hook was
  out of scope for this pass; it stays as it was, and it is the one obvious candidate
  for `GET /students/me/clubs`.
- **No member stacks on the crests.** The hook keeps only *your* membership record from
  each `/clubs/:id/members` response, so the browser never sees the other members'
  names. The crest therefore shows the composition bar and the member numeral from the
  club payload instead of an invented avatar stack. A real `AvatarStack` needs either
  that endpoint change or the hook to keep the member list.

Nothing on this screen is fabricated. Every number and every mark resolves to a field
in one of the existing fetches (`/clubs`, `/clubs/:id/members`, `/users/:id/projects`,
`/events/upcoming`, `/join-requests/student`, `/notifications`,
`/notifications/unread-count`) or to arithmetic over those fields. Grep `// MOCK:` for
the derived ones.
