# AGENTS.md — CNP Department

Guidance for AI agents and contributors working in this repository.

## Project purpose

**CNP Department** is a college platform for **Student Managed Clubs (SMCs)** and **GUIITAR Projects**. Verified users (students, faculty, club/project administrators) discover organizations, participate in clubs and projects, manage events, handle join workflows, notifications, and (for project admins) inventory and material requests.

Five **role experiences** must remain distinct over time (different information architecture, priorities, and actions—not one generic dashboard with swapped cards):

| Role | `User.role` value |
|------|-------------------|
| Student | `student` |
| Faculty Coordinator | `faculty_coordinator` |
| Faculty Mentor | `faculty_mentor` |
| Club Admin | `club_admin` |
| Project Admin | `project_admin` |

**Team leader** is not a global role; it is a **project-level** assignment (`Project.teamLeaderId`).

## Absolute frontend stack (do not replace)

The frontend is **React only**, with the existing toolchain:

- React 19 + React DOM
- TypeScript
- Vite 8
- React Router 7
- Styles: CSS custom properties + one stylesheet per surface (no CSS framework, no CSS-in-JS):
  - `frontend/src/tokens.css` — the only source of colour, space, type, shadow, motion
  - `frontend/src/ui.css` — the signed-in primitive layer (keys, panels, rows, tables, tags, fields, modals)
  - `frontend/src/components/layout/shell.css` — the app shell
  - `frontend/src/pages/<Area>/*.css` — one area stylesheet each, class-prefixed
  - `frontend/src/landing.css` + `base.css` — the public page
  - `frontend/src/app.css` — the legacy sheet: login/register still live here; the rest is being retired
- Shared API client: `frontend/src/services/api.ts`
- Auth: `frontend/src/context/AuthContext.tsx`

Do **not** migrate to Next.js, Vue, Svelte, Angular, or a second SPA. Do **not** add a UI kit or CSS framework without explicit approval and justification.

## Repository layout

```
CNP_Department/
├── backend/          Express 5 API, Mongoose models, JWT auth, Cloudinary uploads
├── frontend/         Vite React SPA (entry: src/main.tsx → App.tsx)
├── design-assets/    Source design files (e.g. loading screen)
├── docs/             Product and implementation briefs
└── .cursor/rules/    Cursor project rules
```

Backend entry: `backend/server.js`. API base path: `/api` (default `http://localhost:5000/api`).

Frontend dev server: Vite default (`npm run dev` in `frontend/`). Configure `VITE_API_URL` via `frontend/.env` (see `.env.example`).

## Architecture (frontend)

- **Routing:** `frontend/src/App.tsx` — public `/login`, `/register`; authenticated tree under `ProtectedRoute` + `AppLayout` (sidebar + header + `<Outlet />`).
- **Guards:** `ProtectedRoute` (auth), `RoleProtectedRoute` (e.g. `project_admin` for `/inventory`, `/material-requests`), profile completeness via `isProfileComplete()` (students need `universityId` + `semester`).
- **Layout:** `AppLayout`, `Sidebar` (`NAVIGATION` role-filtered), `Header` (page title, notification dropdown).
- **Loading:** `LoadingScreen` during auth bootstrap, route transitions (`RouteTransition` in `App.tsx`), and some page spinners.

**Styles:** `main.tsx` loads `app.css` then `ui.css`; `app.css` `@import`s tokens, base and landing.
Treat `frontend/src/style.css` and `main.ts` as unused Vite scaffold unless wired again.
New work uses the primitives in `ui.css` and a token for every value — never a literal colour,
never a raw length where a `--space-*` token exists.

**Design identity — Cobalt:** cool near-white paper, blue-black ink, hairlines over shadows, one
electric cobalt signal (`--color-accent`) for action/active/selection, Familjen Grotesk titles over
IBM Plex Sans body, cut corners on signature objects, tabular numerals. The public landing page and
`docs/redesign-brief.md` are the reference for every new screen. The login page is the original brand
anchor and must keep its story panel; the signed-in shell is its quieter sibling.

## Architecture (backend)

- **Auth:** JWT in `Authorization: Bearer`; identity in `req.user` from middleware (`requireAuth`, `requireRole` / `requireAnyRole`).
- **Data:** MongoDB via Mongoose models under `backend/src/models/`.
- **Responses:** Typically `{ success, message?, data?, token?, user? }` — always read existing route handlers before assuming shapes.

Do **not** change API contracts, database models, or auth semantics unless explicitly tasked.

## Before modifying code

1. Read the files you will touch and their imports (follow the graph, do not assume dead code).
2. Confirm which CSS file is active (`app.css`).
3. Trace data from UI → `api()` → backend route → model.
4. Check role checks on both frontend routes and backend middleware.
5. Prefer extending existing components (`StudentClubCard`, `EventCard`, etc.) over duplicates.

## Coding standards

- **TypeScript:** Functional React components; typed props; avoid new `any` where domain types exist in `frontend/src/types/index.ts`.
- **Components:** Small, composable; separate fetch/hooks from presentation when complexity grows.
- **States:** Handle loading, error, empty, and success explicitly. Never show fabricated metrics or lists as if they came from the API.
- **CSS:** Use existing tokens in `:root` (`--accent`, `--text`, `--border`, etc.). Extend `app.css` or scoped class names—no second global design system.
- **Security:** Token in `localStorage` key `cnp_auth_token`; never log secrets; respect 401/403 from API.

## Backend integration rules

- Base URL: `import.meta.env.VITE_API_URL` (no trailing slash).
- Use `api<T>(method, endpoint, body?)` from `services/api.ts`; throws `ApiError` on non-OK responses.
- Auth endpoints: `POST /auth/login`, `POST /auth/register`, `POST /auth/logout`, `GET /auth/me`.
- After login, incomplete student profiles redirect to `/profile`.

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | `tsc && vite build` |
| `frontend/` | `npm run preview` | Preview production build |
| `backend/` | `npm run dev` | Node watch mode |
| `backend/` | `npm start` | Production server |
| `backend/` | `npm run seed` | Seed database |

There is **no** frontend ESLint/Jest script in `package.json` today; run `npm run build` in `frontend/` to typecheck.

## Related documentation

- `README.md` — overview (note: `PROJECT_DOCUMENTATION.md` is referenced but may be missing from the tree; rely on code and `docs/`).
- `docs/redesign-brief.md` — the design contract for the signed-in app (tokens, primitives, page
  anatomy, motion budget, accessibility floor, file fences).
- `docs/backend-mocks.md` — everything the UI derives or mocks, with the endpoint that would replace it.
- `docs/mocks/` — per-area detail behind that backlog.
- `docs/student-dashboard.md` — the original Student Dashboard implementation brief.
- `.cursor/rules/frontend-design.mdc` — visual and interaction standards.
- `.cursor/rules/react-components.mdc` — React/TS component standards.

## Current implementation notes

- **The shell** (`components/layout/*` + `shell.css`) owns the frame: graphite rail, paper header,
  route transition loader. Pages render inside `.shell-content` and start flush with `.ui-page-head`.
  Do not add outer margins or page-level backgrounds there.
- **Dashboards are split by role**: `pages/Dashboard/Dashboard.tsx` is a thin router that delegates to
  `StudentDashboardPage`, `CoordinatorDashboard`, `ClubAdminDashboard`, `MentorDashboard` and
  `ProjectAdminDashboard`. The five experiences should stay distinguishable.
- **`ui.css` is the shared vocabulary.** Pages compose `.ui-btn`, `.ui-panel`, `.ui-rows`, `.ui-table`,
  `.ui-tag`, `.ui-field`, `.ui-modal`, `.ui-empty`, `.ui-skel`. If a primitive is missing, add it to
  `ui.css` rather than re-inventing it per page.
- **Every list is filtered/searched client-side** over a full fetch, and several counts are derived in
  the browser. `docs/backend-mocks.md` is the backlog for moving those to the API — check it before
  adding a new derived number.
- **Two N+1 calls remain**, both documented: club membership per club and project rosters per project.
  Do not add a third; prefer one endpoint change.
- **`app.css` is legacy.** The class names it defines (`.card`, `.btn`, `.badge`, `.student-dash*`, …)
  are largely unused by the new pages; do not build new work on them, and do not prune the file
  without verifying every remaining consumer (login/register still depend on it).

## Task boundaries for agents

- Inspect before implementing.
- Do not delete existing project files without explicit instruction.
- Do not commit unless the user asks.
- For any UI work: follow `docs/redesign-brief.md` (tokens only, primitives from `ui.css`, focus and
  reduced-motion states, no fabricated data) and keep the app's five role experiences distinct.
- Do not rename or remove API calls, routes, guards or exported component props while restyling.
