# Visual pass — from document to instrument

The first rebuild fixed the *craft*: tokens, hairlines, one signal, a real primitive layer.
This pass fixes the *form*. The complaint is precise and correct:

> There is a lot of text everywhere. Use visuals whenever you can instead of text. Don't
> need to display all the info right away — some data can be neatly tucked under hover
> states. Aesthetics matter. Not a boring admin site.

Read this with `docs/redesign-brief.md`. That one still holds (tokens only, no emoji,
focus/disabled/reduced-motion, no fabricated data). This one adds the harder rule.

---

## 1. The rule

**Every screen is an instrument, not a document.**

A document explains itself with sentences. An instrument shows state with form: position,
length, angle, density, colour, stack, rhythm. When you are about to write a `<p>` that
describes the data, stop and ask what shape that sentence is, then draw the shape.

| Instead of… | Draw… |
|---|---|
| "2 events this week, next in 7 days" | a 14-cell week strip with two filled cells and one marked |
| "42 members, 8 in the core team" | an avatar stack of 8 + a segmented bar at 19% |
| "This club has no faculty coordinator" | a club tile with an empty coordinator slot, hatched |
| "12 pending requests, oldest 2 hours ago" | a queue depth bar with the oldest item's age as a tick |
| "Projects: 3 active, 1 completed" | a 4-cell status rail with proportional widths |
| "Team leader: Riya Sharma" | a leader avatar with a small lead glyph, name on hover |
| "You are a member of 3 clubs" | three crests, lit |
| "Last update 4 days ago" | a sparkline of update cadence, last point marked |

**Text budget.** Per screen, outside of record names and field values:

- Page head: a title and **at most 6 words** of sub-copy. Usually zero.
- Panel headers: a title and a number. No explanatory sentence.
- List rows: **two lines maximum** — a name and one meta line. Everything else is a mark,
  a glyph, a stack, or a hover reveal.
- Empty states: **one sentence**, one action.
- Tooltips: where the deleted sentence goes.

If you keep a sentence, it must earn its place: a destructive warning, a permission
explanation, an error. Never a description of what the user is looking at.

**Box budget.** No panel inside a panel inside a panel. One border level per region:
either a panel with rows, or an open region separated by rules. If you reach for a third
container, delete the middle one. Full-bleed table inside a panel is fine; a "card" inside
a "section" inside a "panel" is not.

---

## 2. The visual grammar

Everything is **inline SVG or CSS**. No chart library, no canvas, no image files for data,
no icon dependency. Hand-authored SVG paths on a 24px grid, `stroke-width` 1.6–1.8.

The primitive layer `components/ui/vis.tsx` (owned by the visual agent) exports the shared
instruments. Read it before building a new one; if something is missing, build it in your
area with your prefix and say so in your report.

```tsx
import { Ring, Sparkline, Bars, Heatmap, Counter, AvatarStack, DateTile,
         Segments, Trend, KindGlyph } from '../../components/ui/vis';
```

- `<Counter value={42} />` — counts up once on mount (180–500ms, eased). Respects reduced motion.
- `<Ring value={0.72} size={44} tone="accent" label="72%" />` — donut gauge, animated stroke.
- `<Sparkline points={[2,5,3,8,6,9]} />` — area or line, optional `marker` on the last point.
- `<Bars data={[{ label, value }]} />` — ranked horizontal bars, labels optional.
- `<Heatmap cells={[{ date, value }]} weeks={12} />` — density grid on the glyph ramp.
- `<AvatarStack people={[...]} max={4} />` — overlapping tiles, overflow as `+N`.
- `<DateTile date={...} />` — weekday / day / month block.
- `<Segments value={8} total={42} />` — machined scale meter.
- `<Trend value={0.12} />` — direction glyph + percentage.
- `<KindGlyph kind="club" />` — the entity glyph set, so "club" reads the same everywhere.

**Use the glyph ramp** (`--color-glyph-1…4`) for density and heat. **Accent is the
signal**, never a series colour: a chart is ink/glyph ramp, with at most one accent mark
(usually "you are here" or "this is now"). Status colour only on status marks, always
paired with a word in the accessible name or a tooltip.

---

## 3. Motion — the part that makes it feel alive

Motion budget per screen: **one ambient loop** (a live dot, a slow gauge pulse, a caret),
plus transitions everywhere, plus **one entrance choreography**.

- **Entrance choreography:** when a page mounts, its regions rise 6px and fade in over
  260ms on a 40ms stagger, capped at ~8 elements. This is the only place animation runs on
  mount. Lists do not animate per row beyond that cap.
- **Numbers** count up once. **Gauges and meters** fill from zero on mount, 420–700ms,
  `--ease-out`. **Bars** grow their width.
- **Hover:** the row's secondary facts slide in (`.ui-row__actions`, inspector meta),
  tiles lift 1px with a hairline darkening, crests brighten.
- **Press:** the existing key depression.
- **View changes** (month, filter, tab): a 160ms cross-fade, never a jump.
- Everything above is disabled under `prefers-reduced-motion: reduce` — values render at
  their final state immediately.

Keep transitions at `--dur-short` unless you have a reason. No bounce, no spring, no
parallax, no scroll-jacking.

---

## 4. Per-area direction

Each area has its own metaphor. Do not converge on a generic grid of stat cards — that is
what is being fixed.

**Student dashboard — "your term".** The semester as a shape: a week strip of real events,
the next event as a ticket stub, clubs as lit crests with member stacks, projects as
progress rails with a status mark. The page should answer "what is my term like" before it
answers "what is in my list".

**Faculty coordinator — "the queue".** Their clubs as tiles with composition rings, and
the request queue as a physical inbox: depth, age ticks, one item in focus. Requests should
feel like work waiting, not a table.

**Club admin — "the coverage map".** A grid of club tiles where the empty coordinator slot
is the loudest thing on the page. Coverage as a ring, gaps as hatched cells.

**Faculty mentor — "the constellation".** Calm, read-mostly. Projects as nodes with a team
orbit and a last-activity sparkline; the mentor's attention is the light source. No primary
button, no destructive control.

**Project admin — "the console".** Gauges and instrument strips, not sentences. Portfolio by
status as proportional blocks, inventory as capacity cells, queues as funnel stages with
depth.

**Clubs — "crests".** A club is a crest, a member stack and a composition bar. The lead
club gets a large plate; the rest are ruled entries with crests. Membership is a lit mark.

**Projects — "the board".** Status as columns with proportional weights, teams as avatar
stacks, the leader with a lead glyph, materials as a coverage meter, and updates as a real
timeline with a spine.

**Events — "the calendar is the page".** Density heat behind the month, day cells as
objects, an event as a ticket stub. The agenda is a schedule rail, not a table.

**Notifications — "signal".** Kind glyphs at a glance, unread as a rising edge, a small
activity sparkline per group. The reading pane is a record, not an essay.

**Operations — "the store room".** Inventory as capacity blocks in a grid with fill level;
requests as a funnel with stage depth. Both should be readable from across the room.

**Profile — "the identity plate".** A ring for completeness, a field grid with glyphs, no
form-looking rows until you edit.

**Shell & chrome.** Command palette (⌘K), tooltips, a shortcuts sheet (`?`), per-route
document titles, and a route progress hairline instead of a full-screen loader.

---

## 5. Feature additions that are welcome

Beyond the required palette / tooltips / shortcuts / metadata:

- Hover inspectors on dense marks (a heatmap cell, a bar, a sparkline point).
- Empty-state art drawn in CSS/SVG (not an illustration file).
- A "now" marker wherever time is plotted.
- Count-up numerals on stat strips.
- A subtle grid/dot paper texture on canvas-like regions (CSS gradients only).
- Keyboard hints inline (`kbd`) where an action has a shortcut.
- Sort and grouping controls that persist in `localStorage` (key `cnp_*`).
- Anything else that makes the screen read faster — but no new fake data.

Every client-side derivation that is new must go in `docs/backend-mocks.md` with a
suggested endpoint, and carry a `// MOCK:` comment.

---

## 6. The floor (unchanged, still non-negotiable)

1. No raw colours outside `tokens.css`. No chart libraries, no canvas, no data images.
2. No emoji. Inline SVG, 24px grid, `currentColor`.
3. `:focus-visible` on everything; hover, active, disabled where they apply.
4. Real semantics: `<button type="button">`, `<a>`/`<Link>`, `aria-pressed`, `aria-expanded`,
   labelled inputs, `role="img"` + `aria-label` on data visuals that carry meaning.
5. **No fabricated data.** Visuals plot real arrays or do not exist.
6. Nothing by colour alone. A red cell carries a value in its accessible name.
7. Keyboard: everything reachable, Escape closes overlays, focus returns to the trigger.
8. Contrast ≥ 4.5:1 for body text. Density ramps may go lighter for *decorative* fills only
   when the value is also available as text or in the accessible name.
9. Reduced motion honoured in your stylesheet.

---

## 7. Fences

Own your area's files. Do not edit:

`app.css`, `tokens.css`, `ui.css`, `base.css`, `landing.css`, `index.html`, `App.tsx`,
`main.tsx`, `components/layout/*` (except where your brief says so), `components/ui/*`
(shared), `package.json`, `backend/**`, or another area's folder.

New CSS in your own area stylesheet, prefixed, tokens only. Other agents are working in the
same tree — ignore TypeScript errors outside your files; never "fix" them by editing files
you do not own. Do not run `npm run build` (half-finished siblings); run `npx tsc --noEmit`
and read only your own lines.

---

## 8. Verify

- Screenshot every route at 1440×900, 1280×800 and 375×812, plus the state you added
  (hover inspector, palette open, empty, loading). Save under `.hallmark/agents/<area>/`.
- **Read your own screenshots.** If a region is a wall of text, a stack of identical boxes,
  or a chart that communicates less than the sentence it replaced, redo it.
- Count the words in your page head and panel heads. If the head has a paragraph, delete it.
- Run the static lint on your files; fix what is real, note what assumes a marketing page.
- Confirm reduced motion, tab order, and that every chart has an accessible name.
