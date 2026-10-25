# Testing

Two suites, one principle: test the things that are expensive to get wrong —
authorisation, inventory arithmetic, and the state machines behind join and
material requests — not markup that will be restyled next week.

```bash
cd backend  && npm test     # 278 passed · ~23s
cd frontend && npm test     # 100 passed ·  ~6s
```

| | Frontend | Backend |
|---|---|---|
| Runner | Vitest 5 | Vitest 5 |
| Environment | jsdom | Node, in-memory MongoDB |
| HTTP | `fetch` stubbed per test | Supertest against the real Express stack |
| Database | none | `mongodb-memory-server` (a real `mongod`) |
| Tests | 100 across 9 files | 278 across 15 files |
| Statements | 95.2 % | 73.4 % |
| Lines | 98.1 % | 74.1 % |
| Functions | 90.1 % | 83.1 % |
| Branches | 87.3 % | 60.9 % |

Why Vitest on both sides: the frontend is Vite 8, and Vitest 5 peer-resolves
against it without forcing a downgrade; the backend is native ESM, so Vitest runs
the real module graph with no transform layer (Jest would need
`--experimental-vm-modules` and per-file wiring).

Why a real `mongod` for the API: the bugs worth catching here live in the
database's semantics — partial unique indexes, `findOneAndUpdate` claims,
`$lookup` aggregations. A stubbed driver would hide exactly those. The first run
downloads a `mongod` binary (~80 MB, cached in `~/.cache/mongodb-binaries`);
every run after that is offline.

---

## What the backend suite protects

The full structure is in [`backend/tests/README.md`](../backend/tests/README.md).

- **The role matrix, per route.** Every mutating route is exercised as a student,
  coordinator, mentor, club admin and project admin. A student cannot create a
  club; a club admin cannot create a project; only a project admin can touch
  inventory or material requests.
- **Ownership, not just role.** A user cannot approve their own join request; a
  coordinator cannot act outside their clubs; a team-leader check reads
  `Project.teamLeaderId`, not the global role.
- **State machines.** Join request → approve → membership, with duplicates
  rejected; material request → approve → stock decremented exactly once, with a
  second approve refused; rejection requires a reason.
- **Arithmetic.** Stock cannot go negative, fractional, or above its total;
  inventory deletion is blocked while allocations or pending requests reference
  the item.
- **Contract shapes.** The `{ success, message?, data? }` envelope and the field
  names the frontend reads, so a rename fails a test rather than a screen.
- **Errors.** Invalid ObjectIds are `400`/`404`, never `500`; missing fields are
  `400`; malformed JSON is a JSON `400`.

## What the frontend suite protects

The full breakdown is in [`frontend/TESTING.md`](../frontend/TESTING.md).

- **`services/api.ts`** — URL building, the auth header, the `Content-Type` rule
  (no body, no preflight), `ApiError` with status and payload, non-JSON error
  bodies, network failure, and the `401` recovery path that clears the token and
  signals the shell.
- **`isProfileComplete`** — students need name, department, phone, university ID
  and semester; staff need the first three; whitespace is missing.
- **`eventDate.ts`** — upcoming/past partitioning, deterministic ordering, an
  undated event landing in the past group rather than behind a `NaN` sort.
- **Guards** — `ProtectedRoute` and `RoleProtectedRoute` redirect and allow
  correctly, with the loader shown while auth bootstraps.
- **`Tooltip`** — opens on focus, wires `aria-describedby`, closes on Escape.
- **The sign-in form** — fields submit the typed values and an API error renders
  visibly.

## What the suites found

They paid for themselves immediately. Each of these is now fixed and covered:

| Finding | Suite |
|---|---|
| Approving a join request was check-then-create — two reviewers could both create a membership | backend |
| `PATCH /join-requests/:id/reject` returned the pre-update status (`pending`) | backend |
| `projectUpdateRoutes` called `deleteAsset` without importing it, orphaning uploads while answering `200` | backend |
| A `401` left the token in `localStorage`, so an expired session became a dead shell | frontend |
| An event with no usable date sorted into Upcoming forever behind a `NaN` comparator | frontend |

## Deliberate gaps

- **Page layouts** are not snapshot-tested. They are being restyled continuously
  and a snapshot would only add churn; behaviour is covered at the module level.
- **Cloudinary** is not called. Upload paths are the largest remaining coverage
  hole; stubbing the boundary is the next step.
- **`eventReminderService`** has no clock-frozen unit tests yet.
- **Concurrency** is covered at the index and claim level, not with parallel
  requests inside one test.

None of these is faked or skipped silently. The backend suite currently has
**zero skipped tests**.
