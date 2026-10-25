/**
 * vis.tsx — the visual instrument library.
 *
 * The visual voice of the signed-in app: machined gauges, density grids, entity
 * glyphs. Every mark is inline SVG or CSS, every colour comes from tokens.css,
 * every numeral is tabular. Read `docs/visual-pass.md` §2 before adding a mark.
 *
 * Rules of the house:
 *  - All visuals are decorative unless they carry data; `aria-label` is set on the
 *    ones that carry data, and purely decorative parts are `aria-hidden`.
 *  - No inline colour literals. Tone is a class (`vis-tone--accent` etc.) that maps
 *    to a token through CSS.
 *  - Motion is 400–600ms on `--ease-out`, fills from empty on mount, and every
 *    animation is disabled under `prefers-reduced-motion: reduce`.
 *  - `className` is always appended last so a page can override layout without
 *    fighting the component.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { prefersReducedMotion, useCountUp } from './useCountUp';

/* ─────────────────────────────────────────────────────────────────────────────
   Shared helpers
   ───────────────────────────────────────────────────────────────────────────── */

export type VisTone = 'accent' | 'positive' | 'warning' | 'negative' | 'ink';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/* One locale for every number and date in the library: en-GB, the same choice the
   rest of the app makes for dates, so "24 Oct" and "4,820" never disagree. */
const INT = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

/** Thousands-grouped integer. The default for every count in the app. */
export function formatCount(n: number): string {
  return INT.format(Number.isFinite(n) ? n : 0);
}

/**
 * Fires once, one frame after mount, so a CSS transition has an "empty" state to
 * travel from. Under reduced motion it starts true, so the first paint is already
 * the final state and nothing flashes.
 */
function useEnter(): boolean {
  const [entered, setEntered] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  return entered;
}

/* Dates are handled in local calendar time: a `YYYY-MM-DD` string is a calendar
   day, never a UTC instant, so a heat cell can never slide a day west. */

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Local `YYYY-MM-DD` key, safe for comparison and grouping. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDay(value: Date | string): Date {
  if (value instanceof Date) return startOfDay(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

const shortDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Monday-based week start — the app's calendar convention. */
function weekStart(d: Date): Date {
  return addDays(startOfDay(d), -((d.getDay() + 6) % 7));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Counter
   ───────────────────────────────────────────────────────────────────────────── */

export interface CounterProps {
  value: number;
  /** ms; default 480 */
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

/**
 * A number that counts up once on mount (and again only when `value` changes).
 * Inherits its size, weight stays display / tabular. Pass `format` for decimals,
 * currency or units — the default is a grouped integer.
 */
export function Counter({ value, duration = 480, format, className }: CounterProps): JSX.Element {
  const shown = useCountUp(value, duration);
  const text = (format ?? formatCount)(shown);
  return <span className={cx('vis-counter', className)}>{text}</span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Ring — donut gauge
   ───────────────────────────────────────────────────────────────────────────── */

export interface RingProps {
  /** 0..1, clamped */
  value: number;
  size?: number;
  thickness?: number;
  tone?: 'accent' | 'positive' | 'warning' | 'negative' | 'ink';
  label?: string;
  caption?: string;
  animate?: boolean;
  className?: string;
}

/**
 * Donut gauge. The arc fills from empty on mount (and from its current position
 * on later value changes), 460ms, butt caps, on a faint track.
 * Omit `label` for a bare gauge; add `caption` for a unit under the number.
 */
export function Ring({
  value,
  size = 44,
  thickness,
  tone = 'accent',
  label,
  caption,
  animate = true,
  className,
}: RingProps): JSX.Element {
  const v = clamp01(value);
  const stroke = thickness ?? Math.max(2, Math.round(size / 14));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const [shown, setShown] = useState<number>(() =>
    animate && !prefersReducedMotion() ? 0 : v,
  );

  useEffect(() => {
    if (!animate || prefersReducedMotion()) {
      setShown(v);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(v));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [v, animate]);

  const centerText = (label ?? caption) ? (
    <span className="vis-ring__center" aria-hidden="true">
      {label ? <span className="vis-ring__label">{label}</span> : null}
      {caption ? <span className="vis-ring__caption">{caption}</span> : null}
    </span>
  ) : null;

  const aria = caption ? `${label ?? `${Math.round(v * 100)}%`}, ${caption}` : (label ?? `${Math.round(v * 100)}%`);

  /* A four-character label at 44px would touch the arc, so the type steps down
     with the string, not just with the ring. */
  const labelLength = (label ?? '').length;
  const labelScale = labelLength <= 3 ? 0.26 : labelLength === 4 ? 0.2 : 0.16;
  const sizeClass = size >= 72 ? 'vis-ring--lg' : size >= 48 ? 'vis-ring--md' : 'vis-ring--sm';

  return (
    <span
      className={cx('vis-ring', `vis-tone--${tone}`, sizeClass, className)}
      style={
        {
          '--vis-size': `${size}px`,
          '--vis-label': `${Math.round(size * labelScale * 10) / 10}px`,
        } as CSSProperties
      }
      role="img"
      aria-label={aria}
    >
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle
          className="vis-ring__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="vis-ring__fill"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          /* Style, not the attribute: only a CSS property change is transitioned. */
          style={{ strokeDashoffset: circumference * (1 - shown) }}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {centerText}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sparkline
   ───────────────────────────────────────────────────────────────────────────── */

export interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  area?: boolean;
  marker?: boolean;
  tone?: 'accent' | 'ink' | 'positive';
  className?: string;
  /** one hover label per point; renders native tooltips */
  labels?: string[];
  /** give the mark an accessible name; otherwise it is decorative */
  ariaLabel?: string;
}

/**
 * A real polyline over `points`. Handles the three degenerate cases honestly:
 * no points → a hairline; one point → a dot; all-equal → a flat mid line.
 * `marker` pins the last point. Rendered at its native `width`/`height` — the
 * page sizes it, the component never invents a viewport.
 */
export function Sparkline({
  points,
  width = 120,
  height = 28,
  area = false,
  marker = false,
  tone = 'accent',
  className,
  labels,
  ariaLabel,
}: SparklineProps): JSX.Element {
  const w = Math.max(8, width);
  const h = Math.max(8, height);
  const pad = 1.5;

  const geometry = useMemo(() => {
    const values = points.filter((n) => typeof n === 'number' && Number.isFinite(n));
    const n = values.length;

    if (n === 0) return { n, line: '', fill: '', last: null as null | { x: number; y: number } };

    if (n === 1) {
      return {
        n,
        line: '',
        fill: '',
        last: { x: w / 2, y: h / 2 },
        dot: { x: w / 2, y: h / 2 },
      };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;

    const xAt = (i: number) => pad + (i * (w - pad * 2)) / (n - 1);
    const yAt = (value: number) =>
      span === 0 ? h / 2 : pad + ((max - value) / span) * (h - pad * 2);

    const coords = values.map((value, i) => [xAt(i), yAt(value)] as const);
    const line = coords
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ');

    const fill = area
      ? `${line} L${coords[n - 1][0].toFixed(2)} ${h} L${coords[0][0].toFixed(2)} ${h} Z`
      : '';

    const last = { x: coords[n - 1][0], y: coords[n - 1][1] };
    return { n, line, fill, last, coords };
  }, [points, w, h, area]);

  const ariaProps = ariaLabel
    ? { role: 'img' as const, 'aria-label': ariaLabel }
    : { 'aria-hidden': true as const };

  return (
    <span className={cx('vis-sparkline', `vis-tone--${tone}`, className)} {...ariaProps}>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} focusable="false" aria-hidden="true">
        {geometry.n === 0 ? (
          <line
            className="vis-sparkline__empty"
            x1={0}
            y1={h / 2}
            x2={w}
            y2={h / 2}
          />
        ) : null}

        {geometry.fill ? <path className="vis-sparkline__area" d={geometry.fill} /> : null}

        {geometry.line ? <path className="vis-sparkline__line" d={geometry.line} /> : null}

        {geometry.n === 1 && 'dot' in geometry && geometry.dot ? (
          <circle
            className="vis-sparkline__marker"
            cx={geometry.dot.x}
            cy={geometry.dot.y}
            r={1.8}
          />
        ) : null}

        {geometry.n > 1 && marker && geometry.last ? (
          <circle
            className="vis-sparkline__marker"
            cx={geometry.last.x}
            cy={geometry.last.y}
            r={2}
          />
        ) : null}

        {labels && labels.length === geometry.n && geometry.n > 1
          ? labels.map((label, i) => {
              const step = (w - pad * 2) / (geometry.n - 1);
              const x = pad + i * step;
              const left = i === 0 ? 0 : x - step / 2;
              const right = i === geometry.n - 1 ? w : x + step / 2;
              return (
                <rect
                  key={`${label}-${i}`}
                  className="vis-sparkline__hit"
                  x={left}
                  y={0}
                  width={Math.max(1, right - left)}
                  height={h}
                  pointerEvents="all"
                >
                  <title>{label}</title>
                </rect>
              );
            })
          : null}
      </svg>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Bars — ranked horizontal bars
   ───────────────────────────────────────────────────────────────────────────── */

export interface BarsProps {
  data: { label?: string; value: number; hint?: string }[];
  max?: number;
  tone?: 'accent' | 'ink' | 'ramp';
  showValues?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Ranked bars that grow from zero on mount. Each bar sits on a hairline scale so
 * the row reads as a measurement, not a pill. `tone="ramp"` grades the ranks down
 * the glyph ramp (glyph-4 → glyph-1); `hint` becomes the row's tooltip.
 * Sort the data yourself — the component draws in the order given.
 */
export function Bars({
  data,
  max,
  tone = 'accent',
  showValues = true,
  className,
  ariaLabel,
}: BarsProps): JSX.Element | null {
  const entered = useEnter();

  const rows = useMemo(
    () => data.filter((d) => Number.isFinite(d.value)),
    [data],
  );

  const hasLabels = rows.some((d) => Boolean(d.label));

  const ceiling = useMemo(() => {
    if (typeof max === 'number' && Number.isFinite(max) && max > 0) return max;
    return rows.reduce((acc, d) => Math.max(acc, d.value), 0);
  }, [max, rows]);

  if (rows.length === 0) return null;

  const rankClass = (i: number): string => {
    if (rows.length < 2) return 'is-rank-4';
    const level = 4 - Math.round((i / (rows.length - 1)) * 3);
    return `is-rank-${level}`;
  };

  return (
    <div
      className={cx('vis-bars', `vis-bars--${tone}`, !hasLabels && 'vis-bars--nolabels', entered && 'is-ready', className)}
      {...(ariaLabel ? { role: 'img', 'aria-label': ariaLabel } : null)}
    >
      {rows.map((row, i) => {
        const frac = ceiling > 0 ? clamp01(row.value / ceiling) : 0;
        return (
          <div
            className={cx('vis-bars__row', tone === 'ramp' && rankClass(i))}
            key={`${row.label ?? 'row'}-${i}`}
            {...(row.hint ? { title: row.hint } : null)}
          >
            {hasLabels ? <span className="vis-bars__label">{row.label}</span> : null}
            <span className="vis-bars__track">
              <span
                className="vis-bars__fill"
                style={{ '--vis-f': frac } as CSSProperties}
              />
            </span>
            {showValues ? (
              <span className="vis-bars__value">{NUM.format(row.value)}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Heatmap — the density calendar
   ───────────────────────────────────────────────────────────────────────────── */

export interface HeatCell {
  date: string;
  value: number;
  hint?: string;
}

export interface HeatmapProps {
  cells: HeatCell[];
  weeks?: number;
  onSelect?: (date: string) => void;
  className?: string;
}

/**
 * A weeks × 7 density grid on the glyph ramp, ending at the newest date it is
 * given (or today when it is given nothing). One element per day keeps hit areas,
 * tooltips and focus honest. Cells with data become buttons only when `onSelect`
 * is supplied; today gets a cobalt hairline.
 */
export function Heatmap({ cells, weeks = 12, onSelect, className }: HeatmapProps): JSX.Element {
  const columns = Math.max(1, Math.round(weeks));

  const grid = useMemo(() => {
    const byDay = new Map<string, HeatCell>();
    let newest: Date | null = null;

    for (const cell of cells) {
      if (!cell || typeof cell.date !== 'string') continue;
      const day = parseDay(cell.date);
      byDay.set(dayKey(day), cell);
      if (!newest || day > newest) newest = day;
    }

    const end = newest ?? startOfDay(new Date());
    const start = addDays(weekStart(end), -(columns - 1) * 7);
    const todayKey = dayKey(startOfDay(new Date()));

    const peak = Array.from(byDay.values()).reduce(
      (acc, cell) => (Number.isFinite(cell.value) ? Math.max(acc, cell.value) : acc),
      0,
    );

    const days: {
      key: string;
      cell: HeatCell | null;
      level: number;
      label: string;
      isToday: boolean;
    }[] = [];

    for (let i = 0; i < columns * 7; i += 1) {
      const day = addDays(start, i);
      const key = dayKey(day);
      const cell = byDay.get(key) ?? null;
      const raw = cell && Number.isFinite(cell.value) ? cell.value : 0;
      const level = raw > 0 && peak > 0 ? Math.min(4, Math.max(1, Math.ceil((raw / peak) * 4))) : 0;
      days.push({
        key,
        cell,
        level,
        isToday: key === todayKey,
        label: `${shortDate(day)} · ${NUM.format(raw)}${cell?.hint ? ` · ${cell.hint}` : ''}`,
      });
    }

    return { days, active: days.filter((d) => d.level > 0).length };
  }, [cells, columns]);

  const summary = `${grid.active} active ${grid.active === 1 ? 'day' : 'days'} across ${columns} weeks`;

  return (
    <div
      className={cx('vis-heat', className)}
      role={onSelect ? 'group' : 'img'}
      aria-label={onSelect ? `Activity calendar, ${summary}` : summary}
    >
      {grid.days.map((day) => {
        const selectable = Boolean(onSelect && day.cell && day.level > 0);
        const common = {
          className: 'vis-heat__cell',
          'data-level': day.level,
          'data-today': day.isToday || undefined,
          'data-empty': !day.cell || undefined,
          title: day.cell ? day.label : undefined,
        } as const;

        if (selectable && onSelect) {
          return (
            <button
              {...common}
              key={day.key}
              type="button"
              aria-label={day.label}
              onClick={() => onSelect(day.key)}
            />
          );
        }

        return <div {...common} key={day.key} aria-hidden={onSelect ? true : undefined} />;
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   AvatarStack
   ───────────────────────────────────────────────────────────────────────────── */

export interface AvatarStackProps {
  people: { name: string; image?: string }[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/**
 * Overlapping tiles with a `+N` overflow. Tiles are separated by a ring in the
 * surface colour (`--vis-av-ring`, defaults to `--color-sheet`); set it to
 * `var(--color-paper-2)` if you mount the stack on a paper-2 row.
 */
export function AvatarStack({
  people,
  max = 4,
  size = 'md',
  className,
}: AvatarStackProps): JSX.Element | null {
  const list = people.filter((p) => p && p.name && p.name.trim());
  if (list.length === 0) return null;

  const limit = Math.max(1, Math.round(max));
  const overflow = list.length > limit ? list.length - Math.max(0, limit - 1) : 0;
  const visible = list.length > limit ? Math.max(0, limit - 1) : list.length;
  const hidden = overflow > 0 ? list.slice(visible) : [];

  return (
    <div className={cx('vis-av-stack', `vis-av-stack--${size}`, className)}>
      {list.slice(0, visible).map((person) => (
        <span
          className="vis-av"
          key={`${person.name}-${person.image ?? ''}`}
          role="img"
          aria-label={person.name}
          title={person.name}
        >
          {person.image ? (
            <img src={person.image} alt="" loading="lazy" />
          ) : (
            <span className="vis-av__mono">{initials(person.name)}</span>
          )}
        </span>
      ))}

      {overflow > 0 ? (
        <span
          className="vis-av vis-av--more"
          role="img"
          aria-label={`${overflow} more ${overflow === 1 ? 'person' : 'people'}`}
          title={hidden
            .slice(0, 6)
            .map((p) => p.name)
            .join(', ') + (hidden.length > 6 ? ' and others' : '')}
        >
          <span className="vis-av__mono">+{overflow}</span>
        </span>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   DateTile
   ───────────────────────────────────────────────────────────────────────────── */

export interface DateTileProps {
  date: Date | string;
  tone?: 'plain' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Weekday / day / month on a cut-corner plate. Accent tone marks "now" or "next";
 * use it once per list. The `<time>` element carries the machine-readable date.
 */
export function DateTile({
  date,
  tone = 'plain',
  size = 'md',
  className,
}: DateTileProps): JSX.Element {
  const day = parseDay(date);

  return (
    <time
      className={cx('vis-date', `vis-date--${size}`, tone === 'accent' && 'vis-date--accent', className)}
      dateTime={dayKey(day)}
    >
      <span className="vis-date__wd">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</span>{' '}
      <span className="vis-date__day">{day.getDate()}</span>{' '}
      <span className="vis-date__mo">{day.toLocaleDateString('en-GB', { month: 'short' })}</span>
    </time>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Segments — the machined scale
   ───────────────────────────────────────────────────────────────────────────── */

export interface SegmentsProps {
  value: number;
  total: number;
  segments?: number;
  tone?: 'accent' | 'positive' | 'ramp';
  className?: string;
  ariaLabel?: string;
}

/**
 * A scale of N machined ticks filled to `value / total`. A partial tick keeps its
 * true fraction — 2.3 of 12 reads as 2.3, not 3. Width is fluid: the parent sets
 * it, the component divides it.
 */
export function Segments({
  value,
  total,
  segments = 12,
  tone = 'accent',
  className,
  ariaLabel,
}: SegmentsProps): JSX.Element {
  const entered = useEnter();
  const count = Math.max(1, Math.round(segments));
  const ratio = total > 0 ? clamp01(value / total) : 0;
  const filled = ratio * count;
  const label = ariaLabel ?? `${NUM.format(value)} of ${NUM.format(total)}`;

  return (
    <span
      className={cx('vis-seg', `vis-seg--${tone}`, entered && 'is-ready', className)}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => {
        const width = clamp01(filled - i);
        /* The ramp completes across the filled run, so a half-full scale still
           shows the whole ramp. glyph-1 is skipped: it is too close to the empty
           tick to read as a fill. */
        const run = Math.max(1, Math.ceil(filled));
        const level = run < 2 ? 4 : 2 + Math.round((i / (run - 1)) * 2);
        return (
          <span className="vis-seg__cell" key={i} data-level={tone === 'ramp' ? Math.min(4, level) : undefined}>
            <span className="vis-seg__fill" style={{ '--vis-w': width } as CSSProperties} />
          </span>
        );
      })}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Trend
   ───────────────────────────────────────────────────────────────────────────── */

export interface TrendProps {
  /** fraction: 0.12 → +12% */
  value: number;
  /** short qualifier after the number, e.g. " this week" */
  suffix?: string;
  /** the sentence, kept in the tooltip and accessible name */
  label?: string;
  className?: string;
}

const TREND_PATHS = {
  up: 'M3 8.6 L8.4 3.2 M4.6 3.2 H8.4 V7',
  down: 'M3 3 L8.4 8.4 M8.4 4.6 V8.4 H4.6',
  flat: 'M2.6 5.8 H8.8',
} as const;

/**
 * Direction + percentage. Monochrome by design: up is not automatically good, so
 * colour is never used for direction — the arrow and the sign carry it, and `label`
 * holds the sentence on hover and in the accessible name. Flat is muted.
 */
export function Trend({ value, suffix, label, className }: TrendProps): JSX.Element {
  const pct = Math.round((Number.isFinite(value) ? value : 0) * 100) || 0;
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const spoken = dir === 'up' ? `Up ${Math.abs(pct)} percent` : dir === 'down' ? `Down ${Math.abs(pct)} percent` : 'No change';
  const text = `${pct > 0 ? '+' : ''}${pct}%`;

  return (
    <span
      className={cx('vis-trend', `vis-trend--${dir}`, className)}
      role="img"
      aria-label={label ? `${spoken}, ${label}` : spoken}
      {...(label ? { title: label } : null)}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={TREND_PATHS[dir]} />
      </svg>
      <span className="vis-trend__num" aria-hidden="true">
        {text}
        {suffix ? <span className="vis-trend__suffix">{suffix}</span> : null}
      </span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   KindGlyph
   ───────────────────────────────────────────────────────────────────────────── */

export type Kind =
  | 'club'
  | 'project'
  | 'event'
  | 'request'
  | 'system'
  | 'inventory'
  | 'notification'
  | 'member'
  | 'mentor'
  | 'update';

export interface KindGlyphProps {
  kind: Kind;
  size?: number;
  className?: string;
}

/**
 * One entity set, one weight. 24px grid, 1.7 stroke, `currentColor`, round caps.
 * Decorative by default: the thing beside it carries the name.
 */
export function KindGlyph({ kind, size = 18, className }: KindGlyphProps): JSX.Element {
  return (
    <svg
      className={cx('vis-glyph', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[kind]}
    </svg>
  );
}

const GLYPHS: Record<Kind, ReactNode> = {
  club: (
    <>
      <path d="M12 3.4 L19 5.9 V11.7 C19 16 16.1 19.3 12 20.7 C7.9 19.3 5 16 5 11.7 V5.9 Z" />
      <path d="M8.7 11.4 H15.3" />
    </>
  ),
  project: (
    <>
      <path d="M12 2.9 L20.6 7.1 L12 11.3 L3.4 7.1 Z" />
      <path d="M3.4 11.7 L12 15.9 L20.6 11.7" />
      <path d="M3.4 16.3 L12 20.5 L20.6 16.3" />
    </>
  ),
  event: (
    <>
      <path d="M4.6 5.6 H19.4 V19.8 H4.6 Z" />
      <path d="M4.6 9.8 H19.4" />
      <path d="M8.6 3.2 V7.2" />
      <path d="M15.4 3.2 V7.2" />
      <rect x="8.4" y="13" width="3" height="3" rx="0.4" fill="currentColor" stroke="none" />
    </>
  ),
  request: (
    <>
      <path d="M12 3 V11.4" />
      <path d="M8.7 8.2 L12 11.5 L15.3 8.2" />
      <path d="M3.4 13.2 H7.7 L9.3 16 H14.7 L16.3 13.2 H20.6 V19.6 H3.4 Z" />
    </>
  ),
  system: (
    <>
      <rect x="8.4" y="8.4" width="7.2" height="7.2" rx="1" />
      <path d="M8.4 3.4 V6.4" />
      <path d="M15.6 3.4 V6.4" />
      <path d="M8.4 17.6 V20.6" />
      <path d="M15.6 17.6 V20.6" />
      <path d="M3.4 8.4 H6.4" />
      <path d="M3.4 15.6 H6.4" />
      <path d="M17.6 8.4 H20.6" />
      <path d="M17.6 15.6 H20.6" />
    </>
  ),
  inventory: (
    <>
      <path d="M12 3.4 L20.4 7.7 V16.3 L12 20.6 L3.6 16.3 V7.7 Z" />
      <path d="M3.6 7.7 L12 12 L20.4 7.7" />
      <path d="M12 12 V20.6" />
    </>
  ),
  notification: (
    <>
      <path d="M12 3.4 C15.4 3.4 17.6 6 17.6 9.4 V13.4 L19.2 16.2 H4.8 L6.4 13.4 V9.4 C6.4 6 8.6 3.4 12 3.4 Z" />
      <path d="M10 19 A2.3 2.3 0 0 0 14 19" />
    </>
  ),
  member: (
    <>
      <circle cx="12" cy="8.2" r="3.5" />
      <path d="M4.8 20.2 C4.8 16.3 8 14.2 12 14.2 C16 14.2 19.2 16.3 19.2 20.2" />
    </>
  ),
  mentor: (
    <>
      <circle cx="10.2" cy="9.4" r="2.9" />
      <path d="M4.4 20 C4.4 16.5 7 14.6 10.2 14.6 C13.4 14.6 16 16.5 16 20" />
      <path d="M18.4 3.4 L19.3 5.5 L21.4 6.4 L19.3 7.3 L18.4 9.4 L17.5 7.3 L15.4 6.4 L17.5 5.5 Z" />
    </>
  ),
  update: <path d="M3 12.4 H7.3 L9.6 6.2 L13.6 18 L15.7 12.4 H21" />,
};

/* ─────────────────────────────────────────────────────────────────────────────
   Meter
   ───────────────────────────────────────────────────────────────────────────── */

export interface MeterProps {
  value: number;
  max?: number;
  tone?: 'accent' | 'positive' | 'warning';
  className?: string;
  ariaLabel?: string;
}

/**
 * The quiet fill: one 6px rule that fills from zero on mount. Height and tone are
 * tunable from the page (`--vis-meter-h`). For a scale with discrete ticks use
 * `Segments`; for composition over a known whole, use `Segments` too.
 */
export function Meter({
  value,
  max = 1,
  tone = 'accent',
  className,
  ariaLabel,
}: MeterProps): JSX.Element {
  const entered = useEnter();
  const frac = max > 0 ? clamp01(value / max) : 0;
  const label = ariaLabel ?? `${Math.round(frac * 100)}%`;

  return (
    <span
      className={cx('vis-meter', `vis-tone--${tone}`, entered && 'is-ready', className)}
      role="img"
      aria-label={label}
    >
      <span className="vis-meter__fill" style={{ '--vis-f': frac } as CSSProperties} />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   GridBg
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Dot paper for canvas-like regions. CSS only, no layout impact — but it is
 * absolutely positioned, so the parent must be `position: relative`. Keep content
 * above it (`position: relative` or a z-index of 1).
 */
export function GridBg({ className }: { className?: string }): JSX.Element {
  return <div className={cx('vis-grid-bg', className)} aria-hidden="true" />;
}
