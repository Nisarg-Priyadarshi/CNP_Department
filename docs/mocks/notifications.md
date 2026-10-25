# Notifications — what is client-side today

The inbox keeps every existing endpoint and every derived value. Nothing below invents a
record: each row is an item returned by `GET /api/notifications`.

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Type filter (All / Requests / Clubs / Projects / Events / System) | Inbox toolbar, "All types" menu | `GET /notifications` returns one flat page of 50; there is no type or kind query param | `GET /notifications?type=<enum>&limit=` |
| Read-state counts on the All / Unread segment, and their level marks | Inbox toolbar | Counted from the loaded page. The endpoint also returns `unreadCount`, but the list itself is capped at 50, so the toolbar stays consistent with what is on screen | `GET /notifications?status=unread&limit=&cursor=` |
| Family share bars in the type menu | "All types" menu | Same page, same counts — the bar is `family count / total loaded` | `GET /notifications/summary` |
| "Mark unread" | Reading pane | No `PATCH /notifications/:id/unread` exists — only `/read` and `/read-all`. The action is omitted rather than faked locally, so a reload cannot contradict the UI | `PATCH /notifications/:id/unread` |
| Day groups (Today / Yesterday / Earlier) | Inbox list | Grouped from `createdAt` with `useMemo`; the server returns a flat newest-first list | none needed |
| Day-group density ticks (one tick per item, cobalt = unread) | Day group headers | Derived from the loaded group's `createdAt` + `isRead`; capped at 8 ticks, the count numeral carries the truth | none needed |
| Arrival strip — 14 days of daily counts, newest day marked | Panel head, right | `/notifications` returns no time series; the window is zero-filled and grouped from `createdAt` of the loaded page | `GET /notifications/summary?days=14` |
| Row scanning line (entity, quantity, place) | Every row | The payload ships one prose `message`; the line is assembled from metadata fields that already exist (`entityName`, `quantity`, `projectName` / `clubName`, `actorName`). A message that only repeats the title is dropped rather than shown twice | a structured `summary` field per notification |
| Relative time on rows ("12m", "3h", "14:20", "24 Oct") | Inbox list | Derived from `createdAt`; the exact timestamp is in the row tooltip and in the record head | none needed |
| Kind label ("Material rejected", "Mentor feedback", …) and family glyph | Row glyph, record plate | Derived from the `type` string plus the existing `title.includes('feedback')` check; there is no taxonomy field | `type` as a documented enum, or a `kind` field |
| Feedback / rejection quotes | Reading pane | Read from `metadata.feedbackText` and `metadata.reason` already present in the payload | none needed |
| Record fact grid | Reading pane | Field order and glyph per fact are presentation; every value is a metadata field as returned | none needed |
| Record body for a pending request (subject / requester) | Reading pane | Some `project_join_request` rows carry only `status` + `requestDate`, so the record shows those two facts rather than naming a project or a person it does not have | include `projectName` / `actorName` in the join-request notification metadata |

Marked with `// MOCK:` in `frontend/src/pages/Notifications/Notifications.tsx`.
