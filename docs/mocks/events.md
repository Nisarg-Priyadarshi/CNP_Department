# Events — what is derived, filtered or mocked on the client

The events area uses the existing endpoints unchanged: `GET /clubs`, `GET /events`
(faculty coordinator and club admin), `GET /events/upcoming?from=` (students and other roles),
`POST /events`, `PUT /events/:id`, `DELETE /events/:id`. Permission checks (`canManageEvent`,
`canAddEvent`) and the local-day helpers (`partitionEvents`, `isEventPast`, `localDayStartIso`,
`useLocalDay`) are untouched.

Everything below is computed from data those calls already return. Every derivation that feeds a
visual carries a `// MOCK:` comment in `Events.tsx`.

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| "N this month" count, the month grid, its "N events" meta and the day count marks | `/events` page-head ledger; month panel | The page has no month-scoped call — it slices the list it already holds | `GET /events?month=YYYY-MM` or `GET /events/summary?month=YYYY-MM` returning counts |
| Density level per day (0–4 on the glyph ramp) | Month surface, cell shading | The grid is a client-side slice, so the ramp is scaled against the busiest day the browser can see | Month summary endpoint above, returning `perDay` counts |
| Week bar set (events per calendar week of the month) | Month panel header | Same slice, grouped into Sunday-based weeks in the browser | `GET /events/summary?month=YYYY-MM` returning `perWeek` counts |
| Per-club event counts and their ranked bars | "Clubs" panel (month and agenda) | Client-side tally over the month's events, deliberately kept from the unfiltered list so the panel works as a filter switcher | Include `clubId` counts in the month summary endpoint |
| "N upcoming" / "N past" and the past group | Page-head ledger, agenda, "Past events" disclosure | Only `/events` (all events) is available, and only to coordinators/admins; there is no `/events/past` | `GET /events/past?before=&limit=` |
| Past events are invisible to students | Month grid for a month that has ended | `GET /events/upcoming?from=` only returns today onward, so an elapsed month renders empty even though events happened. Not shown as a "no events" claim — the grid simply has no marks | Let `/events/upcoming` accept `from` in the past, or expose `GET /events?window=` to all signed-in roles |
| Club filter (`All clubs · N`, single-club view) | Page-head select and the "Clubs" panel | `GET /events` takes no query parameters; the page filters the array it holds | `GET /events?clubId=` |
| "In 7 days" / "Today" / "17 days ago" labels and the relative-day scale | Event detail stub, rail day nodes | Derived from `eventDate` and the local day, no server field | Not needed — this is presentation |
| Agenda grouping by day, and the time column | Agenda rail, selected-day rail | Groups the fetched list by local calendar day (the same rule `partitionEvents` uses) | Not needed |
| Event organiser name and role | Event detail "Organiser" row | Reads the populated `createdBy` that `GET /events` already returns; falls back to "Not recorded" when it is absent | None |
| Club crest (logo or initial) | Day rail tickets, agenda, detail header, `EventCard` | `GET /events` populates `clubId.logo`; when a club has no logo the initial is drawn locally | None |

## Flow changes worth knowing

- `DELETE /events/:id` is still the same call behind the same guard (an explicit confirmation before
  the request). The event-level delete button lives in the detail stub rather than on every card, so
  the capability is reachable in one extra step.
- Editing moved from an inline panel at the top of the page into a modal; the form's fields,
  validation, `FormData` payload and `PUT`/`POST` choice are unchanged.
- The detail and form modals are rendered through a React portal into `<body>` so the scrim covers
  the shell chrome and the dialog centres on the viewport instead of on the scrollable content
  column (which contains `position: fixed` because the shell establishes a containing block). This
  changes no route, guard or API call.
