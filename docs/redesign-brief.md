# Signed-in app — redesign brief

Everything behind the login wall is being rebuilt in the same visual language as the
public landing page. This file is the contract. Read it before you touch a file.

The landing page (`frontend/src/pages/Landing/*`, `landing.css`) is the finished
reference. Open it at <http://localhost:5173/> and study it: the same paper, the same
ink, the same one signal, the same restraint.

---

## 1. What good looks like

A signed-in screen should read as **a tool an institution trusts**, not a marketing page
and not a bootstrap admin template:

- **Ruled, not boxed.** Prefer hairlines, alignment and whitespace over stacked cards
  with shadows. A panel earns a border; a row earns a rule.
- **Dense but calm.** Real data, tight vertical rhythm (rows at 8–12px padding), no
  empty decorative containers, no "hero" band inside the app.
- **One signal.** Cobalt marks action, active state and selection. Nothing else is blue.
- **Evidence over prose.** Numbers, dates, names, states. If a fact needs a paragraph to
  explain it, it is the wrong element for a dashboard.
- **Quiet motion.** 120–220ms transitions that confirm a pointer or a state change. No
  entrance animations on data, no bouncing, no parallax. One scroll-linked or looping
  affordance per page at most.

The user's standing instruction applies to every screen:

> Use visuals whenever you can instead of text, avoid clutter, the design language must
> be clean. If you can replace a textual element with a form of visual, do that. Neat
> animations. You don't need to display all the info right away either: some data can be
> neatly tucked under hover states, only visible when needed.

---

## 2. Tokens

**Never write a colour, a spacing length, a radius, a shadow or a duration as a literal.**
Everything is in `frontend/src/tokens.css`. The ones you will use most:

| Token | Use |
|---|---|
| `--color-paper` | page background |
| `--color-paper-2` / `-3` | wells, hovers, table heads |
| `--color-sheet` | panels, fields, modal faces |
| `--color-ink` / `--color-ink-2` | headings / body |
| `--color-muted` | secondary text, meta |
| `--color-rule` / `--color-rule-2` | internal hairlines / panel edges |
| `--color-graphite`, `-2`, `-ink`, `-muted` | the dark rail |
| `--color-accent`, `-deep`, `-2`, `-wash`, `-ink`, `-edge` | the signal |
| `--color-positive` / `--color-warning` / `--color-negative` + `-wash` | status |
| `--color-scrim` | modal backdrop |
| `--space-3xs … --space-4xl` | 2, 4, 8, 12, 16, 24, 40, 64, 96, 128 |
| `--text-xs … --text-xl`, `--text-lead`, `--text-title` | type scale (12 → 24) |
| `--dur-micro/short/long`, `--ease-out/in/in-out` | motion |
| `--radius-card` (8), `--radius-input` (6) | corners |
| `--shadow-card`, `--shadow-lift`, `--shadow-lift-strong` | elevation |
| `--shell-w`, `--head-h`, `--ui-max` | shell metrics |
| `--z-sticky`, `--z-dropdown`, `--z-modal` | layering |

Type: **Familjen Grotesk** for titles, names and numbers (`--font-display`, weight 600,
tracking `--tracking-display`); **IBM Plex Sans** for everything else (`--font-body`).
Body size 15px, line-height 1.55. Numerals are tabular inside the shell.

Raw values are only allowed for sub-4px optical corrections (`1px`, `2px`, `3px`) and
percentages inside transforms.

---

## 3. The primitive layer — `frontend/src/ui.css`

Already written and loaded globally. **Use it; do not restyle it.** Add layout in your own
stylesheet, not new skins for these classes.

### Buttons
```jsx
<button className="ui-btn ui-btn--primary">New event</button>
<button className="ui-btn">Export</button>
<button className="ui-btn ui-btn--quiet ui-btn--sm">Filter</button>
<button className="ui-btn ui-btn--ghost">Cancel</button>
<button className="ui-btn ui-btn--danger ui-btn--sm">Remove</button>
<button className="ui-icon-btn" aria-label="More">…</button>
```
Modifiers: `--primary` (one per screen), `--quiet`, `--ghost`, `--danger`, `--sm`, `--lg`,
`--block`. Disabled, hover, active and focus states are all defined.

### Panels
```jsx
<section className="ui-panel">
  <header className="ui-panel__head">
    <div className="ui-panel__titles">
      <h2 className="ui-panel__title">Members</h2>
      <span className="ui-panel__meta">128</span>
    </div>
    <button className="ui-btn ui-btn--quiet ui-btn--sm">Manage</button>
  </header>
  <div className="ui-panel__body">…</div>
  <footer className="ui-panel__foot">…</footer>
</section>
```
`__body--flush` removes padding (use with `.ui-rows` or `.ui-table`). `--accent` gives the
panel the cobalt edge: use it once per page, for the page's main object.

### Rows (the workhorse for lists)
```jsx
<ul className="ui-rows">
  <li className="ui-row ui-row--link">
    <span className="ui-avatar">N</span>
    <div className="ui-row__main">
      <p className="ui-row__title">Photography Club</p>
      <p className="ui-row__sub">42 members · Faculty coordinator Dr. Neha Verma</p>
    </div>
    <div className="ui-row__meta"><span className="ui-tag is-positive">Active</span></div>
    <div className="ui-row__actions">
      <button className="ui-btn ui-btn--quiet ui-btn--sm">Open</button>
    </div>
  </li>
</ul>
```
`.ui-row__actions` is invisible until hover or `:focus-within` — this is the sanctioned way
to tuck secondary actions away. Never hide primary actions that way.

### Tables
`.ui-table` for genuinely tabular data (inventory, members, requests). Head cells are
sentence case, muted, untracked. `.is-num` right-aligns.

### Tags
`.ui-tag` + `.is-positive` / `.is-warning` / `.is-negative` / `.is-accent`, or `--plain`
for neutral labels with no dot. Tags are rectangles, not pills.

### Fields
```jsx
<label className="ui-label" htmlFor="club-name">Club name</label>
<input id="club-name" className="ui-field" />
<p className="ui-hint">Shown on the public club directory.</p>
```
`ui-field--area`, `ui-field--select`, `ui-search` (with an inline SVG magnifier),
`ui-form-row ui-form-row--2`.

### Everything else
- `.ui-page-head` + `.ui-title` / `.ui-sub` / `.ui-page-actions` — the head of every route.
- `.ui-stats` + `.ui-stat__value` / `.ui-stat__label` — a strip of 3–5 honest numbers.
- `.ui-tabs`, `.ui-seg` — tabs and segmented filters.
- `.ui-menu` (popover), `.ui-overlay` + `.ui-modal` (+ `--wide`/`--narrow`).
- `.ui-empty` (mark, title, one line, one action), `.ui-notice` / `--error`.
- `.ui-skel` — skeleton blocks shaped like the content they replace.
- `.ui-avatar`, `.ui-person`, `.ui-count`, `.ui-kbd`, `.ui-meter`.
- Utilities: `.ui-stack`, `.ui-cluster`, `.ui-between`, `.ui-grow`, `.ui-truncate`,
  `.ui-scroll-x`, `.ui-grid-2` (define locally if you need a specific split).

If a primitive is missing, build it **inside your own area's stylesheet** with your
prefix, and say so in your report so it can be promoted later.

---

## 4. Shell contract

The shell is owned by one agent and renders `<Outlet />` inside:

```html
<div class="shell">
  <aside class="shell-rail">…</aside>
  <div class="shell-main">
    <header class="shell-header">…</header>
    <main class="shell-content"><Outlet /></main>
  </div>
</div>
```

`.shell-content` already applies the page gutter (24px top, 32px sides, 48px bottom), the
`--ui-max` max-width and centring, and is the scroll container. **Do not add outer
margins or your own full-width backgrounds** — your page root starts flush at the top of
that area with `.ui-page-head`.

If the shell has not been rebuilt yet while you work, your page will render inside the old
`.main-content`. Build against the contract above; it will land.

---

## 5. Page anatomy

```
.ui-page-head            title · one-line sub · actions (search, filter, primary)
.ui-stats (optional)     3–5 numbers, only if the data exists
[main object]            one panel, or a 12-column split: 8 for the list, 4 for the aside
[secondary]              rows, table, timeline
```

- **Lists** are ruled rows or tables, never grids of identical cards unless the item is
  genuinely visual (a club, a project).
- **Detail pages** are a two-column composition: main column (description, members,
  events, requests) and a sticky aside (status, people, dates, actions). On narrow
  screens the aside drops below.
- **Empty states** say what would be here and give the one action that starts it.
- **Loading** is skeleton shaped like the final layout, not a spinner over a blank page.
- **Errors** are a `.ui-notice--error` with a retry control; never a silent blank.
- **Counts** come from the data you already fetched; never invent totals.

Cross-cutting flows you may improve: collapse duplicate pages, turn read-only lists into
split views, move destructive actions behind a menu, replace `window.confirm` with a
styled modal **only if you keep the same guard conditions**. You may not remove a
capability: every action that exists today must still be reachable.

---

## 6. Motion

- Transitions, not animations: `transition: background-color var(--dur-short) var(--ease-in-out)`.
- Hover reveals (row actions, meta) are the signature move.
- One looping affordance per page maximum (a live dot, a meter fill, a pulse on unread).
- Any animation must be disabled under `prefers-reduced-motion: reduce` — add the guard
  to your own stylesheet:

```css
@media (prefers-reduced-motion: reduce) {
  .your-area *, .your-area *::before, .your-area *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. The floor (non-negotiable)

1. No raw colours anywhere (`#hex`, `rgb()`, `hsl()`, `oklch()`) outside `tokens.css`.
2. No emoji. Icons are inline SVG, 24px grid, `stroke-width` 1.6–1.8, `currentColor`.
3. Every interactive element has visible `:focus-visible` (the shell sets a global ring;
   keep it), plus hover/active, plus disabled where a disabled state can occur.
4. Real semantics: `<button type="button">` for actions, `<a>`/`<Link>` for navigation,
   `aria-pressed` for toggles, `aria-expanded` for disclosures, labels bound to inputs.
5. No fabricated data, no fake names, no placeholder counts. Derive from the API or omit.
6. Nothing conveys meaning by colour alone — pair status colour with a word or a mark.
7. Keyboard: everything reachable, Escape closes overlays, focus returns to the trigger.
8. Contrast: body text ≥ 4.5:1 on its surface. Muted text is for meta only.
9. English copy, sentence case, no exclamation marks, no jargon the students would not use.

---

## 8. Fences

**Never edit** `frontend/src/app.css`, `tokens.css`, `ui.css`, `base.css`, `landing.css`,
`index.html`, `package.json`, `frontend/src/App.tsx`, or anything under `backend/`.
Never change an API call, an endpoint, a request body, a route path, a localStorage key,
a guard condition, or the props/exports of a component you do not own.

**New CSS** lives in a file inside your area (e.g. `src/pages/Events/events.css`) and is
imported by your area's root component. Prefix every class with your area name
(`.evt-`, `.clubs-`, `.prj-`, `.ntf-`, `.ops-`, `.prf-`, `.dash-`, `.shell-`).

**Other agents are editing other folders in the same working tree right now.** Ignore
TypeScript or build errors in files you do not own; never "fix" them by editing those
files. Do not run `npm run build` (it will fail on someone else's half-finished file);
run `npx tsc --noEmit` and read only the lines pointing at your own files.

---

## 9. Verify

Dev server: <http://localhost:5173> (already running). API: `http://localhost:5001/api`.

| Role | Email | Password |
|---|---|---|
| Student | `arjun.mehta@test.com` | `Test@12345` |
| Faculty coordinator | `neha.verma@test.com` | `Test@12345` |
| Faculty mentor | `amit.joshi@test.com` | `Test@12345` |
| Club admin | `karan.shah@test.com` | `Test@12345` |
| Project admin | `vivek.malhotra@test.com` | `Test@12345` |

Screenshot recipe (puppeteer-core is available in the Hallmark clone):

```js
import { createRequire } from 'node:module';
const require = createRequire(
  '/private/var/folders/pb/9pb5x5xx1lq39s682jpb00nr0000gn/T/opencode/hallmark/noop.js',
);
const puppeteer = require('puppeteer-core');

const res = await fetch('http://localhost:5001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'arjun.mehta@test.com', password: 'Test@12345' }),
});
const { token } = await res.json();

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument((t) => localStorage.setItem('cnp_auth_token', t), token);
await page.goto('http://localhost:5173/events', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: '.hallmark/agents/events/list.png' });
```

Save shots under `.hallmark/agents/<your-area>/`. Check desktop (1440×900), a narrow
laptop (1280×800) and mobile (375×812). Read your own screenshots and fix what looks
wrong — misalignment, orphaned labels, overflow, dead space, contrast.

Static lint (no auth needed, files only):

```bash
export HALLMARK_PUPPETEER=/private/var/folders/pb/9pb5x5xx1lq39s682jpb00nr0000gn/T/opencode/hallmark
node "$HALLMARK_PUPPETEER/skills/hallmark/scripts/sloplint.mjs" <your files> --genre modern-minimal
```

Its render tier cannot sign in, so your own screenshots are the visual check. Fix what is
real in the static report — raw colours, emoji, missing focus/disabled/reduced-motion,
glued arrow glyphs, decorative labels above headings, inconsistent spacing. Findings that
assume a marketing page (hero fold, section mass, page word budget) do not apply inside
the app; note them and move on. Do not add waiver comments to silence gates you have not
actually solved.

---

## 10. Log what you mock

If you show something the API does not return — a derived count, a placeholder chart, a
disabled control you invented, a client-side filter over data the server would normally
filter — record it in `docs/mocks/<your-area>.md`:

```md
| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Club activity sparkline | Club detail aside | `/clubs/:id` returns no time series | `GET /clubs/:id/activity?days=30` |
```

and mark the code with a `// MOCK:` comment so it can be grepped later.

---

## 11. Report back

Return: files added/changed, the screens you redesigned and what changed in the flow,
features you added, what you mocked (file path), what is unfinished, your screenshot
paths, and anything you deliberately left alone.
