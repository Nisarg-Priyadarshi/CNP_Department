# Operations console — what is mocked or client-side

Screens: `/inventory` and `/material-requests` (`pages/Inventory`, `pages/MaterialRequests`).
Nothing below invents a record, a name or a count. Every list, name, quantity and date
comes from `GET /inventory`, `GET /allocations` or `GET /material-requests`.

## Inventory — the store room wall

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Capacity fill (available ÷ `totalQuantity`) and its low-stock threshold rule | Each shelf cell | `GuitarInventory` has no minimum-stock field. "Low" is a presentation rule: available stock is under 25% of that item's own `totalQuantity` (`LOW_STOCK_RATIO` in `Inventory.tsx`). It never changes stock. The threshold is drawn as the dashed datum across each cell, with the number in the cell's tooltip. **This threshold is a mock policy**; replace it with a real field before treating it as an operational alert. | Add `minimumStock` to `GuitarInventory`, returned by `GET /inventory`; or `GET /inventory/stock-health`. |
| Shelf order (emptiest first) | Cell grid | The API returns items in insertion order. The page sorts by state (out → low → ok), then by fill, then by name so the weakest shelf reads first. | `GET /inventory?sort=stock-asc` if the server should own the order. |
| "On the shelf" gauge (`available` of `total` units), "Issued" (`total − available`) and its project stack | Console strip | Both unit totals are summed from the two fields the API already returns. The project stack is the distinct `projectId` set on the returned allocations. "Issued" counts every unit not on the shelf, so a manual `PATCH /inventory/:id/quantity` can make it differ from the sum of allocation records. | `GET /inventory/summary` returning `totalUnits`, `availableUnits`, `allocatedUnits` and the distinct projects. |
| "Low" tick rail | Console strip | One tick per item under the threshold, with names in the tooltip and the accessible name. | Same `minimumStock` change as above. |
| Per-cell hover facts (category · location · updated) | Shelf cell | Every field is in the `GET /inventory` payload; the cell shows the level by default and tucks the rest under hover. | None |
| Item search and category filter | Page head | `GET /inventory` returns every item; the filter narrows the client list. The category select only renders when at least one item has a category. | `GET /inventory?q=&category=` |

The seven-column stock table is gone; the same fields now sit in the capacity cells
(available/total as fill + numerals), the cell's accessible name, and the hover line.

## Material requests — the pipeline

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Pipeline funnel (pending → approved → rejected) with proportional widths | Pipeline panel | Counts are computed from the single `GET /material-requests` list; bar width is each count over the total. | `GET /material-requests/summary` with a `counts` block; or `?status=` per stage. |
| Waiting rail (one tick per pending request, oldest in cobalt) | Pipeline panel | Derived from pending `createdAt`. Ages are plotted against the oldest pending request (the right edge is that age), not against a server window. | `GET /material-requests/summary` returning `oldestPendingAt`; a real time-to-decision endpoint if the rail should cover resolved requests too. |
| Requested-vs-stock bar | Review ticket, drawer, approve modal | Both numbers are in the payload (`quantity`, `inventoryItemId.availableQuantity`). The bar is the request against the shelf; the vertical mark is stock on hand. | None |
| "Left after" numeral | Drawer, approve modal | Subtraction of requested from available at read time. Shown only while pending, since `availableQuantity` on an approved request is already post-approval. | None |
| Waiting chip per ticket (`3h`) | Review ticket | Derived duration from `createdAt`. | `GET /material-requests/summary` |
| Status / project / text filters and their counts | Pipeline panel + search | `GET /material-requests` returns the full list. The three pipeline stages are the status filter (pressed = filtered); project + text filters are in the head. Counts come from the same list. | `GET /material-requests?status=&projectId=&q=`. |
| Resolved ledger collapsed by default | Material requests | Presentation only; the data is already in the list. | None |
| Approved/rejected row opens the drawer | Material requests | The drawer reuses the existing populated request object; no extra fetch. | None |
| Requester identity as an avatar | Ticket, drawer, approve modal | The avatar carries initials; name, email, department and semester are in its title and in the row's accessible name. | None |
| Approve confirmation | Approve modal | Replaces `window.confirm` with a styled modal. The guard is identical: if requested quantity exceeds current stock it warns that approval may fail and offers "Attempt approval"; otherwise it shows the stock bar and the projected remaining units. | None |
| Refresh buttons | Pipeline panel, resolved head | Re-read the same endpoint; no extra capability. | None |

No bulk approve/reject action was added. Rejecting still requires a non-empty
`rejectionReason` and still posts to `PATCH /material-requests/:id/reject`; approving
still posts to `PATCH /material-requests/:id/approve`.

## Shared stylesheet repairs

`ops.css` restores a few `ui.css` declarations that the legacy `app.css` overrides by
specificity on the page where those primitives are used (not a new skin):

- bare `label` → `text-transform: none` and normal tracking;
- bare `input[type]` / `select` / `textarea` → sheet background, rule border, body font
  and size for `.ui-field`;

These should be fixed in the primitive layer or the global reset so no other area has to
repeat them.

## Shell interaction note

The shell's route wrapper (`.route-enter`) keeps a transform after its animation, which
turns any `position: fixed` descendant into a positioned box the height of the page. Both
console overlays therefore mount through `pages/Inventory/OpsOverlay.tsx` (a portal to
`<body>`), which restores viewport centring. Other areas with fixed overlays will hit the
same offset; the durable fix is to drop the transform from `.route-enter` once its
animation ends (or animate only opacity).
