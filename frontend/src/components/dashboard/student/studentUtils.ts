/* Derivations the student dashboard needs on top of the dashboard fetches:
   events arrive as `unknown[]`, dates need calendar-day arithmetic, and join
   requests carry either a populated reference or a bare id. Everything here is
   derived from data the page already holds; nothing is invented. */
import type { ClubMembershipRecord, StudentJoinRequest } from '../../../types/studentDashboard';

const DAY_MS = 86_400_000;

export interface StudentEvent {
  _id: string;
  title: string;
  eventDate?: string;
  location?: string;
  description?: string;
  clubId?: { _id?: string; name?: string; logo?: string | null } | string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Narrow the `/events/upcoming` payload to the fields the page renders. */
export function asEvent(value: unknown): StudentEvent | null {
  if (!isRecord(value)) return null;
  const id = optionalString(value._id);
  const title = optionalString(value.title);
  if (!id || !title) return null;
  return {
    _id: id,
    title,
    eventDate: optionalString(value.eventDate) ?? optionalString(value.date),
    location: optionalString(value.location),
    description: optionalString(value.description),
    clubId: isRecord(value.clubId) || typeof value.clubId === 'string' ? (value.clubId as StudentEvent['clubId']) : null,
  };
}

export function sortEvents(events: StudentEvent[]): StudentEvent[] {
  return [...events].sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
}

function eventTimestamp(event: StudentEvent): number {
  if (!event.eventDate) return Number.POSITIVE_INFINITY;
  const time = new Date(event.eventDate).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

export function eventDateValue(event: StudentEvent): Date | null {
  if (!event.eventDate) return null;
  const date = new Date(event.eventDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function clubNameOf(event: StudentEvent): string | null {
  const club = event.clubId;
  if (!club || typeof club === 'string') return null;
  return club.name?.trim() || null;
}

export function clubLogoOf(event: StudentEvent): string | null {
  const club = event.clubId;
  if (!club || typeof club === 'string') return null;
  return club.logo?.trim() || null;
}

/** Populated references arrive as `{ _id }`, bare ones as a string. */
export function refId(ref: { _id?: string } | string | null | undefined): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === 'string') return ref || undefined;
  return ref._id;
}

export function refName(ref: { name?: string } | string | null | undefined): string | null {
  if (!ref || typeof ref === 'string') return null;
  return ref.name?.trim() || null;
}

/* ── Calendar arithmetic (local days, so "tomorrow" means the student's tomorrow) ── */

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function calendarDaysUntil(value: string | Date, now = new Date()): number | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((startOfLocalDay(date) - startOfLocalDay(now)) / DAY_MS);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Local `YYYY-MM-DD` key — a calendar day, never a UTC instant. */
export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Monday-based week start, the app's calendar convention. */
export function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/* ── The term strip ──────────────────────────────────────────────────────────
   A six-week horizon, Monday first, plotted day by day. This is a *window onto
   the data the page already fetched* — not a new fetch. Everything it draws is
   the real event list placed on its real date. */

export const TERM_WEEKS = 6;

export interface TermDay {
  key: string;
  date: Date;
  /** 0-based day inside the horizon. */
  index: number;
  isToday: boolean;
  isWeekStart: boolean;
  events: StudentEvent[];
}

export interface TermWindow {
  days: TermDay[];
  /** Monday of each week column, in order. */
  weeks: Date[];
  start: Date;
  end: Date;
  /** Events that fall after the horizon — counted, never dropped silently. */
  later: StudentEvent[];
  /** Events with a real date inside the horizon. */
  placed: number;
}

/** MOCK: the horizon, the week grouping and the per-day density are placed in
    the browser. `/events/upcoming` returns a flat list with dates; no endpoint
    returns a term window or a per-day count. */
export function buildTermWindow(
  events: StudentEvent[],
  now = new Date(),
  weeks = TERM_WEEKS,
): TermWindow {
  const start = mondayOf(now);
  const total = weeks * 7;
  const todayKey = localDayKey(now);

  const days: TermDay[] = [];
  const byKey = new Map<string, TermDay>();
  const weekStarts: Date[] = [];

  for (let index = 0; index < total; index += 1) {
    const date = addDays(start, index);
    const day: TermDay = {
      key: localDayKey(date),
      date,
      index,
      isToday: localDayKey(date) === todayKey,
      isWeekStart: index % 7 === 0,
      events: [],
    };
    days.push(day);
    byKey.set(day.key, day);
    if (day.isWeekStart) weekStarts.push(date);
  }

  const end = addDays(start, total);
  const later: StudentEvent[] = [];
  let placed = 0;

  for (const event of events) {
    const date = eventDateValue(event);
    if (!date) continue;
    const day = byKey.get(localDayKey(date));
    if (day) {
      day.events.push(event);
      placed += 1;
    } else if (startOfDay(date) >= end) {
      later.push(event);
    }
  }

  for (const day of days) {
    day.events.sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  }

  return { days, weeks: weekStarts, start, end, later, placed };
}

/* ── Countdown ──────────────────────────────────────────────────────────────
   The ring shows closeness on a fortnight, the numeral carries the true day
   count. `value` is a position on that scale, never a claimed percentage. */

export const COUNTDOWN_HORIZON = 14;

/** MOCK: the ring's scale is a display convention (a fortnight), not a fact the
    API returns; the numeral beside it is the real day count. */
export function closenessFor(days: number | null, horizon = COUNTDOWN_HORIZON): number {
  if (days === null) return 0;
  if (days <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - days / horizon));
}

export interface Countdown {
  /** Large numeral, when the distance is worth showing as a number. */
  value?: string;
  /** The unit beside it, or the whole word for today/tomorrow. */
  label: string;
  /** One-line form for prose. */
  sentence: string;
}

export function countdownFor(days: number | null): Countdown | null {
  if (days === null) return null;
  if (days <= 0) return { label: 'Today', sentence: 'today' };
  if (days === 1) return { label: 'Tomorrow', sentence: 'tomorrow' };
  return { value: String(days), label: 'days', sentence: `in ${days} days` };
}

/* ── Formatting ── */

/** "Sat 24 Oct" — the compact form the head and the strip labels use. */
export function formatCompactDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "24 Oct" — no weekday, for the week ruler. */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;
}

export function formatWeekday(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short' });
}

export function formatDayNumber(date: Date): string {
  return String(date.getDate());
}

export function formatMonthShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short' });
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
}

/** "Just now", "12m ago", "3h ago", "4d ago", then a plain date. */
export function relativeTime(value: string | undefined, now = new Date()): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = calendarDaysUntil(date, now);
  if (days !== null && days < 7) return `${Math.max(days, 1)}d ago`;
  return formatDayMonth(date);
}

/* The same letters the club crest draws: the significant words, so "Photography
   Club" reads PH on the dashboard and on the directory. */
export function initialsOf(name: string): string {
  const cleaned = name
    .replace(/\b(club|society|committee|association|collective|group|cell)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = (cleaned || name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/* ── Domain labels ── */

export interface MembershipRole {
  label: string;
  core: boolean;
}

export function membershipRole(record: ClubMembershipRecord): MembershipRole {
  const position = record.position?.trim();
  const core = record.membershipType === 'core_team';
  if (core && position) return { label: position, core: true };
  if (core) return { label: 'Core team', core: true };
  if (position) return { label: position, core: false };
  return { label: 'Member', core: false };
}

export interface ProjectStatus {
  label: string;
  tone: 'positive' | 'warning' | 'plain';
}

export function projectStatus(status: string | undefined): ProjectStatus | null {
  if (!status?.trim()) return null;
  const key = status.trim().toLowerCase();
  if (key === 'active') return { label: 'Active', tone: 'positive' };
  if (key === 'completed') return { label: 'Completed', tone: 'plain' };
  if (key === 'inactive' || key === 'archived') return { label: 'Inactive', tone: 'plain' };
  if (key === 'on_hold' || key === 'paused') return { label: 'On hold', tone: 'warning' };
  return { label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(), tone: 'plain' };
}

/** MOCK: the project payload carries a status word, not a pipeline stage. The
    rail plots that word at one of three positions (started / active / closed). */
export function projectStage(status: string | undefined): 0 | 1 | 2 | 3 {
  const key = status?.trim().toLowerCase();
  if (!key) return 0;
  if (key === 'completed' || key === 'done') return 3;
  if (key === 'active' || key === 'in_progress') return 2;
  return 1;
}

export interface RequestStatus {
  label: string;
  tone: 'positive' | 'warning' | 'negative' | 'plain';
}

export function requestStatus(status: string): RequestStatus {
  const key = status.toLowerCase();
  if (key === 'pending') return { label: 'Pending', tone: 'warning' };
  if (key === 'approved') return { label: 'Approved', tone: 'positive' };
  if (key === 'rejected') return { label: 'Rejected', tone: 'negative' };
  return { label: status, tone: 'plain' };
}

export function requestTarget(request: StudentJoinRequest): {
  kind: 'Club' | 'Project';
  id?: string;
  name: string;
} {
  const club = typeof request.clubId === 'object' && request.clubId ? request.clubId : null;
  const project = typeof request.projectId === 'object' && request.projectId ? request.projectId : null;
  if (club || typeof request.clubId === 'string') {
    return {
      kind: 'Club',
      id: refId(request.clubId),
      name: club?.name?.trim() || 'Club',
    };
  }
  return {
    kind: 'Project',
    id: refId(request.projectId),
    name: project?.name?.trim() || 'Project',
  };
}
