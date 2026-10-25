import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { EventForm } from '../../components/events/EventForm';
import { EventCrest } from '../../components/events/EventCrest';
import { isEventPast, localDayStartIso, partitionEvents, useLocalDay } from '../../eventDate';
import { usePageLoading } from '../../context/LoadingContext';
import { Counter, DateTile, KindGlyph } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import './events.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

/* ── Marks ───────────────────────────────────────────────────────────────── */

function Icon({ children, className = 'evt-i' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const MARK = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 20.5s6.2-5.1 6.2-9.7a6.2 6.2 0 1 0-12.4 0c0 4.6 6.2 9.7 6.2 9.7Z" />
      <circle cx="12" cy="10.6" r="2.2" />
    </>
  ),
  left: <path d="m14.5 6-6 6 6 6" />,
  right: <path d="m9.5 6 6 6-6 6" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  arrow: <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  trash: (
    <path d="M4 7h16M9.5 7V4.8h5V7M6.6 7l.8 12a1.6 1.6 0 0 0 1.6 1.4h6a1.6 1.6 0 0 0 1.6-1.4l.8-12" />
  ),
  link: (
    <>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7.5" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0L6.5 13a3.5 3.5 0 0 0 5 5L13 16.5" />
    </>
  ),
  file: (
    <>
      <path d="M13 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V8.5L13 3.5Z" />
      <path d="M13 3.5V8.5H18" />
    </>
  ),
};

/* ── Date helpers ────────────────────────────────────────────────────────── */

function eventDate(event: any): Date | null {
  const raw = event?.eventDate || event?.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function clubNameOf(event: any): string {
  const club = typeof event?.clubId === 'object' && event.clubId !== null ? event.clubId : null;
  return club?.name || 'Department Club';
}

function clubLogoOf(event: any): string | null {
  const club = typeof event?.clubId === 'object' && event.clubId !== null ? event.clubId : null;
  return club?.logo || null;
}

function timeLabel(date: Date | null): string {
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}

function relativeDay(date: Date, today: Date): string {
  const diff = Math.round((startOfDay(date) - startOfDay(today)) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

function groupByDay(events: any[]) {
  const groups: { key: string; date: Date | null; items: any[] }[] = [];
  events.forEach(event => {
    const date = eventDate(event);
    const key = date ? dayKey(date) : 'tbd';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(event);
    else groups.push({ key, date, items: [event] });
  });
  return groups;
}

/** Density steps on the glyph ramp: 1 event is light, the busiest day is deep. */
function densityLevel(count: number, peak: number): number {
  if (count <= 0 || peak <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / peak) * 4)));
}

/* ── Instruments ─────────────────────────────────────────────────────────── */

interface WeekBucket {
  key: string;
  start: Date;
  count: number;
}

/**
 * The month's rhythm as a bar set: one bar per calendar week, height by event
 * count, hover for the week-by-week reading. Bars are a macro view of the same
 * numbers the grid shades cell by cell.
 */
function WeekBars({ weeks }: { weeks: WeekBucket[] }) {
  const peak = weeks.reduce((max, week) => Math.max(max, week.count), 0);
  const barWidth = 9;
  const gap = 3;
  const height = 26;
  const width = Math.max(8, weeks.length * (barWidth + gap) - gap);
  const summary = `Events per week: ${weeks.map(week => week.count).join(', ')}`;

  return (
    <Tooltip
      label={
        <span className="evt-tipweeks">
          {weeks.map(week => (
            <span key={week.key} className="evt-tipweeks__row">
              <span>{week.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              <span>
                {week.count} {week.count === 1 ? 'event' : 'events'}
              </span>
            </span>
          ))}
          <span className="evt-tipweeks__note">Day shading follows the same counts.</span>
        </span>
      }
    >
      <span className="evt-weekbars" role="img" aria-label={summary}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {weeks.map((week, i) => (
            <rect
              key={`slot-${week.key}`}
              className="evt-weekbars__slot"
              x={i * (barWidth + gap)}
              y={0}
              width={barWidth}
              height={height}
              rx="1"
            />
          ))}
          {weeks.map((week, i) => {
            const barHeight =
              week.count === 0 ? 3 : Math.max(6, Math.round((week.count / (peak || 1)) * (height - 6)));
            return (
              <rect
                key={week.key}
                className="evt-weekbars__bar"
                data-empty={week.count === 0 || undefined}
                x={i * (barWidth + gap)}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx="1"
              />
            );
          })}
          <line
            className="evt-weekbars__base"
            x1="0"
            y1={height - 0.5}
            x2={width}
            y2={height - 0.5}
          />
        </svg>
      </span>
    </Tooltip>
  );
}

/**
 * The distance between today and the event, as a rule with a scale: today
 * pinned at its end, the event at its distance (clamped at 8 slots), the day
 * count beside it. Past events mirror the same rule.
 */
function CountdownMark({ date, today }: { date: Date; today: Date }) {
  const diff = Math.round((startOfDay(date) - startOfDay(today)) / DAY_MS);
  const past = diff < 0;
  const step = Math.min(8, Math.abs(diff));
  const slot = 10;
  const width = slot * 8;
  const rawToday = past ? width : 0;
  const rawEvent = past ? width - step * slot : step * slot;
  // Keep both strokes inside the viewBox so an edge day still shows its mark.
  const todayX = Math.min(Math.max(rawToday, 0.75), width - 0.75);
  const eventX = Math.min(Math.max(rawEvent, 1.5), width - 1.5);
  const label = relativeDay(date, today);

  return (
    <Tooltip
      label={`${label} · ${date.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}`}
    >
      <span className={`evt-count${past ? ' is-past' : ''}`} role="img" aria-label={label}>
        <svg
          className="evt-count__rule"
          width={width}
          height={14}
          viewBox={`0 0 ${width} 14`}
          aria-hidden="true"
          focusable="false"
        >
          <line className="evt-count__base" x1="0" y1="13" x2={width} y2="13" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={i}
              className="evt-count__tick"
              x1={i * slot}
              y1={i === 0 || i === 8 ? 8 : 10}
              x2={i * slot}
              y2="13"
            />
          ))}
          <line className="evt-count__now" x1={todayX} y1="4" x2={todayX} y2="13" />
          <line className="evt-count__event" x1={eventX} y1="2" x2={eventX} y2="13" />
        </svg>
        <span className="evt-count__num" aria-hidden="true">
          {diff === 0 ? 'Today' : `${Math.abs(diff)}d`}
        </span>
      </span>
    </Tooltip>
  );
}

/* ── One event as a ticket ───────────────────────────────────────────────── */

interface TicketProps {
  event: any;
  canManage: boolean;
  onOpen: (event: any, trigger: HTMLElement) => void;
  onEdit: (event: any, trigger: HTMLElement) => void;
}

function EventTicket({ event, canManage, onOpen, onEdit }: TicketProps) {
  const date = eventDate(event);
  const past = isEventPast(event.eventDate || event.date);
  const club = clubNameOf(event);
  const clock = timeLabel(date);

  return (
    <li className={`evt-ticket${past ? ' is-past' : ''}`}>
      <span className="evt-ticket__time" aria-hidden="true">
        {clock || 'TBD'}
      </span>

      <div className="evt-ticket__body">
        <button
          type="button"
          className="evt-ticket__open"
          aria-label={`${event.title}, ${club}${clock ? `, ${clock}` : ''}${event.location ? `, ${event.location}` : ''}${past ? ', past' : ''}`}
          onClick={e => onOpen(event, e.currentTarget)}
        >
          <EventCrest name={club} logo={clubLogoOf(event)} size={22} />
          <span className="evt-ticket__main">
            <span className="evt-ticket__title" title={event.title}>
              {event.title}
            </span>
            <span className="evt-ticket__meta">
              {event.location && (
                <span className="evt-ticket__venue">
                  <Icon className="evt-i evt-i--xs">{MARK.pin}</Icon>
                  <span className="ui-truncate">{event.location}</span>
                </span>
              )}
              <span className="evt-ticket__club ui-truncate">{club}</span>
            </span>
          </span>
          <span className="evt-ticket__who ui-truncate">{club}</span>
          {past && <span className="evt-ticket__flag">Past</span>}
          <span className="evt-ticket__go" aria-hidden="true">
            <Icon className="evt-i evt-i--sm">{MARK.arrow}</Icon>
          </span>
        </button>

        {canManage && (
          <div className="evt-ticket__actions">
            <button
              type="button"
              className="ui-icon-btn"
              aria-label={`Edit ${event.title}`}
              onClick={e => onEdit(event, e.currentTarget)}
            >
              <Icon className="evt-i evt-i--sm">{MARK.edit}</Icon>
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function TicketList({ events, canManage, onOpen, onEdit }: {
  events: any[];
  canManage: (event: any) => boolean;
  onOpen: (event: any, trigger: HTMLElement) => void;
  onEdit: (event: any, trigger: HTMLElement) => void;
}) {
  return (
    <ul className="evt-timeline">
      {events.map(event => (
        <EventTicket
          key={event._id}
          event={event}
          canManage={canManage(event)}
          onOpen={onOpen}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );
}

/** A day on the rail: its plate, its distance from today, its depth. */
function DayNodeHead({
  date,
  count,
  today,
  isToday,
}: {
  date: Date | null;
  count: number;
  today: Date;
  isToday: boolean;
}) {
  return (
    <header className="evt-daynode">
      <div className="evt-daynode__plate">
        {date ? (
          <DateTile date={date} size="sm" tone={isToday ? 'accent' : 'plain'} />
        ) : (
          <span className="evt-daynode__tbd">TBD</span>
        )}
        {date && <span className="evt-daynode__rel">{relativeDay(date, today)}</span>}
        <span className="evt-daynode__count">
          <Counter value={count} />
        </span>
      </div>
    </header>
  );
}

/* ── One day of the month surface ────────────────────────────────────────── */

interface DayCellProps {
  date: Date;
  events: any[];
  level: number;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: Date) => void;
  onOpen: (event: any, trigger: HTMLElement) => void;
}

function DayCell({ date, events, level, isToday, isSelected, onSelect, onOpen }: DayCellProps) {
  const shown = events.slice(0, 2);
  const extra = events.length - shown.length;
  const label = `${date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })}, ${events.length} ${events.length === 1 ? 'event' : 'events'}`;

  return (
    <div
      className={`evt-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
      data-level={level || undefined}
    >
      <div className="evt-cell__head">
        <button
          type="button"
          className="evt-cell__num"
          aria-pressed={isSelected}
          aria-label={label}
          onClick={() => onSelect(date)}
        >
          {date.getDate()}
        </button>
        {events.length > 0 && (
          <span className="evt-cell__n" aria-hidden="true">
            {events.length}
          </span>
        )}
      </div>

      <div className="evt-cell__chips">
        {shown.map(event => {
          const past = isEventPast(event.eventDate || event.date);
          const when = timeLabel(eventDate(event));
          return (
            <Tooltip
              key={event._id}
              label={[when, clubNameOf(event), event.location].filter(Boolean).join(' · ')}
            >
              <button
                type="button"
                className={`evt-chip${past ? ' is-past' : ''}`}
                aria-label={`${event.title}, ${clubNameOf(event)}${when ? `, ${when}` : ''}${past ? ', past' : ''}`}
                onClick={e => onOpen(event, e.currentTarget)}
              >
                <span className="evt-chip__title">{event.title}</span>
              </button>
            </Tooltip>
          );
        })}

        {extra > 0 && (
          <button
            type="button"
            className="evt-cell__more"
            aria-label={`Show all ${events.length} events on ${date.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}`}
            onClick={() => onSelect(date)}
          >
            +{extra} more
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Clubs in the month: a ranked bar per club ───────────────────────────── */

interface ClubsPanelProps {
  clubs: { id: string; name: string; count: number }[];
  peak: number;
  selected: string;
  onToggle: (id: string) => void;
}

function ClubsPanel({ clubs, peak, selected, onToggle }: ClubsPanelProps) {
  return (
    <section className="ui-panel evt-clubs evt-rise" style={{ '--evt-i': 3 } as CSSProperties} aria-labelledby="evt-clubs-title">
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 id="evt-clubs-title" className="ui-panel__title">
            Clubs
          </h2>
          <span className="ui-panel__meta">{clubs.length} this month</span>
        </div>
      </header>
      <ul className="evt-clublist">
        {clubs.map(club => {
          const pressed = selected === club.id;
          const frac = peak > 0 ? club.count / peak : 0;
          const inner = (
            <>
              <EventCrest name={club.name} size={22} />
              <span className="evt-clubrow__main">
                <span className="evt-clubrow__name">{club.name}</span>
                <span
                  className="evt-clubrow__bar"
                  style={{ '--evt-f': frac } as CSSProperties}
                  aria-hidden="true"
                />
              </span>
              <span className={`ui-count${pressed ? ' ui-count--accent' : ''}`}>{club.count}</span>
            </>
          );

          return (
            <li key={club.id}>
              {club.id === 'department' ? (
                <div className="evt-clubrow">{inner}</div>
              ) : (
                <button
                  type="button"
                  className="evt-clubrow"
                  aria-pressed={pressed}
                  aria-label={`${club.name}, ${club.count} ${club.count === 1 ? 'event' : 'events'} this month`}
                  onClick={() => onToggle(club.id)}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function Events() {
  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();
  const today = useLocalDay();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Club context and filter
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [myAssignedClubs, setMyAssignedClubs] = useState<any[]>([]);
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'agenda'>('month');

  // Detail and delete state
  const [detailEvent, setDetailEvent] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      const clubsRes = await api<any>('GET', '/clubs').then(res => res.data).catch(() => []);
      setAllClubs(clubsRes);

      let assigned: any[] = [];
      if (user?.role === 'faculty_coordinator') {
        assigned = clubsRes.filter((c: any) => {
          const coordId = typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId?._id : c.facultyCoordinatorId;
          return coordId === user._id;
        });
        setMyAssignedClubs(assigned);
      } else if (user?.role === 'club_admin') {
        assigned = clubsRes;
        setMyAssignedClubs(clubsRes);
      }

      let evts: any[] = [];
      // Faculty Coordinator and Club Admin must see events from ALL clubs
      if (user?.role === 'faculty_coordinator' || user?.role === 'club_admin') {
        evts = await api<any>('GET', '/events').then(res => res.data).catch(() => []);
      } else {
        // Students and other roles view upcoming events across all clubs
        evts = await api<any>('GET', `/events/upcoming?from=${encodeURIComponent(localDayStartIso())}`).then(res => res.data).catch(() => []);
      }
      setEvents(evts);
    } catch (e) {
      console.error('Error loading events:', e);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user, today]);

  useEffect(() => {
    if (!loading && window.location.hash) {
      setTimeout(() => {
        const el = document.querySelector(window.location.hash as string);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [loading]);

  /* ── Overlays ──────────────────────────────────────────────────────────── */

  const openDetail = (event: any, trigger?: HTMLElement | null) => {
    returnFocus.current = trigger ?? null;
    setDetailEvent(event);
    setConfirmDelete(false);
    setDeleteError('');
  };

  const closeDetail = () => {
    const trigger = returnFocus.current;
    setDetailEvent(null);
    setConfirmDelete(false);
    setDeleteError('');
    returnFocus.current = null;
    if (trigger) window.setTimeout(() => trigger.focus(), 0);
  };

  const openForm = (event: any | null, trigger?: HTMLElement | null) => {
    returnFocus.current = trigger ?? null;
    setEditingEvent(event);
    setShowForm(true);
    setDetailEvent(null);
    setConfirmDelete(false);
    setDeleteError('');
  };

  const closeForm = () => {
    const trigger = returnFocus.current;
    setShowForm(false);
    setEditingEvent(null);
    returnFocus.current = null;
    if (trigger) window.setTimeout(() => trigger.focus(), 0);
  };

  const finishForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    returnFocus.current = null;
    loadEvents();
  };

  const deleteEvent = async () => {
    if (!detailEvent) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api('DELETE', `/events/${detailEvent._id}`);
      setEvents(prev => prev.filter(e => e._id !== detailEvent._id));
      const trigger = returnFocus.current;
      setDetailEvent(null);
      setConfirmDelete(false);
      returnFocus.current = null;
      if (trigger) window.setTimeout(() => trigger.focus(), 0);
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (detailEvent) closeBtnRef.current?.focus();
  }, [detailEvent]);

  useEffect(() => {
    if (!detailEvent && !showForm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showForm) closeForm();
        else if (detailEvent) closeDetail();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep focus inside the open modal.
      const modal = document.querySelector('.ui-overlay .ui-modal');
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailEvent, showForm]);

  /* ── Derived data (unchanged rules) ────────────────────────────────────── */

  // Filter by selected club if set
  let filteredEvents = events;
  if (selectedClubFilter !== 'all') {
    filteredEvents = filteredEvents.filter(e => {
      const eClubId = typeof e.clubId === 'object' ? e.clubId?._id : e.clubId;
      return eClubId === selectedClubFilter;
    });
  }

  const { upcoming: upcomingEvents, past: pastEvents } = partitionEvents(filteredEvents);

  // Authorization check for event management
  const canManageEvent = (e: any) => {
    if (user?.role === 'club_admin') return true;
    if (user?.role === 'faculty_coordinator') {
      const eClubId = typeof e.clubId === 'object' ? e.clubId?._id : e.clubId;
      return myAssignedClubs.some(c => c._id === eClubId);
    }
    return false;
  };

  const canAddEvent =
    user?.role === 'club_admin' || (user?.role === 'faculty_coordinator' && myAssignedClubs.length > 0);

  /* ── Calendar logic ────────────────────────────────────────────────────── */

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const trailingBlank = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  const monthLabel = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const monthKey = `${year}-${month}`;

  const getEventsForDay = (day: number) => {
    return filteredEvents.filter(e => {
      const d = eventDate(e);
      return d !== null && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  // MOCK: the month grid, its "N events" meta, the week bars and the "upcoming
  // this month" count are a client-side slice of the fetched list; no endpoint
  // returns a month tally. See docs/mocks/events.md.
  const monthEvents = filteredEvents.filter(e => {
    const d = eventDate(e);
    return d !== null && d.getFullYear() === year && d.getMonth() === month;
  });
  const upcomingThisMonth = monthEvents.filter(e => !isEventPast(e.eventDate || e.date)).length;

  // MOCK: per-day counts and their density level are a client-side slice of the
  // fetched list, scaled against the busiest day in view. See docs/mocks/events.md.
  const density = days.map(day => {
    const items = getEventsForDay(day);
    return { day, items, count: items.length };
  });
  const dayPeak = density.reduce((max, cell) => Math.max(max, cell.count), 0);

  // MOCK: week-by-week counts for the month header bar set — same client-side
  // slice, no `/events?month=` endpoint exists yet.
  const weekBuckets: WeekBucket[] = (() => {
    const weekCount = Math.ceil((firstDay + daysInMonth) / 7);
    return Array.from({ length: weekCount }, (_, w) => {
      const start = new Date(year, month, 1 - firstDay + w * 7);
      const end = new Date(year, month, 1 - firstDay + w * 7 + 7);
      const count = monthEvents.filter(e => {
        const d = eventDate(e);
        return d !== null && d >= start && d < end;
      }).length;
      return { key: `${monthKey}-w${w}`, start, count };
    });
  })();

  const todayDate = new Date(today);
  const todayKey = dayKey(todayDate);
  const selectedKey = selectedDate ? dayKey(selectedDate) : null;
  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate.getDate()) : [];
  const seesPast = user?.role === 'faculty_coordinator' || user?.role === 'club_admin';
  const nextEvent = upcomingEvents[0] ?? null;
  const nextEventDate = nextEvent ? eventDate(nextEvent) : null;

  const goToMonth = (offset: number) => {
    setCurrentMonth(new Date(year, month + offset, 1));
    setSelectedDate(null);
  };
  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(null);
  };
  const toggleDay = (date: Date) => {
    setSelectedDate(prev => (prev && dayKey(prev) === dayKey(date) ? null : date));
  };
  const jumpToDay = (date: Date) => {
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedDate(date);
  };

  /* ── Selected day / next-up rail ───────────────────────────────────────── */

  const sideEvents = selectedDate ? selectedDayEvents : [];
  const sideCount = selectedDate ? selectedDayEvents.length : upcomingEvents.length;
  const sideTitle = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Next up';
  const selectedRelative = selectedDate ? relativeDay(selectedDate, todayDate) : '';
  const filteredClubName =
    selectedClubFilter === 'all'
      ? ''
      : allClubs.find(c => c._id === selectedClubFilter)?.name || 'This club';

  // MOCK: per-club event counts are a client-side tally over the month's events,
  // kept from the unfiltered list so the panel can switch the active club.
  const clubsThisMonth = (() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    events
      .filter(e => {
        const d = eventDate(e);
        return d !== null && d.getFullYear() === year && d.getMonth() === month;
      })
      .forEach(e => {
        const club = typeof e.clubId === 'object' && e.clubId !== null ? e.clubId : null;
        const id = club?._id || 'department';
        const name = club?.name || 'Department Club';
        const row = map.get(id);
        if (row) row.count += 1;
        else map.set(id, { id, name, count: 1 });
      });
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  })();
  const clubPeak = clubsThisMonth.reduce((max, club) => Math.max(max, club.count), 0);

  const showAllClubs = () => {
    setSelectedClubFilter('all');
    setSelectedDate(null);
  };

  /* ── Loading ───────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="evt-page">
        <header className="ui-page-head">
          <div className="ui-page-head__text">
            <div className="ui-skel evt-skel evt-skel--title" />
            <div className="ui-skel evt-skel evt-skel--sub" />
          </div>
        </header>
        <div className="evt-month evt-month--loading" aria-busy="true">
          <section className="ui-panel">
            <header className="ui-panel__head">
              <div className="ui-skel evt-skel evt-skel--bar" />
              <div className="ui-skel evt-skel evt-skel--bar" />
            </header>
            <div className="evt-grid evt-grid--loading">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="evt-skel-cell">
                  <span className="ui-skel evt-skel--line" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const detailDate = detailEvent ? eventDate(detailEvent) : null;
  const detailClub =
    detailEvent && typeof detailEvent.clubId === 'object' && detailEvent.clubId !== null
      ? detailEvent.clubId
      : null;
  const detailOrganiser =
    detailEvent && typeof detailEvent.createdBy === 'object' && detailEvent.createdBy !== null
      ? detailEvent.createdBy
      : null;
  const detailCreated = detailEvent?.createdAt ? new Date(detailEvent.createdAt) : null;
  const detailIsPast = detailEvent ? isEventPast(detailEvent.eventDate || detailEvent.date) : false;
  const detailManage = detailEvent ? canManageEvent(detailEvent) : false;

  /* The rail's one empty state, shared by the selected day and Next up. */
  const sideEmpty = (
    <div className="evt-side__empty">
      <span className="ui-empty__mark">
        <KindGlyph kind="event" size={17} />
      </span>
      <p className="ui-empty__title">
        {events.length === 0
          ? 'No events yet'
          : selectedClubFilter !== 'all'
            ? `Nothing from ${filteredClubName}`
            : selectedDate
              ? 'Nothing on this day'
              : 'Nothing upcoming'}
      </p>
      <p className="ui-empty__text">
        {events.length === 0
          ? canAddEvent
            ? 'Publish the first event to fill the calendar.'
            : 'Club events appear here when they are published.'
          : selectedClubFilter !== 'all'
            ? 'This club has no events in view.'
            : selectedDate
              ? nextEvent && nextEventDate
                ? `Next: ${nextEvent.title}, ${nextEventDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`
                : 'Pick another day.'
              : 'Past events stay on the calendar.'}
      </p>
      {events.length === 0 && canAddEvent && (
        <button
          type="button"
          className="ui-btn ui-btn--sm"
          onClick={e => openForm(null, e.currentTarget)}
        >
          New event
        </button>
      )}
      {events.length > 0 && selectedClubFilter !== 'all' && (
        <button type="button" className="ui-btn ui-btn--sm" onClick={showAllClubs}>
          Show all clubs
        </button>
      )}
      {events.length > 0 && selectedClubFilter === 'all' && selectedDate && nextEventDate && (
        <button
          type="button"
          className="ui-btn ui-btn--quiet ui-btn--sm"
          onClick={() => jumpToDay(nextEventDate)}
        >
          Go to {nextEventDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </button>
      )}
    </div>
  );

  return (
    <div className="evt-page">
      {/* Page head */}
      <header className="ui-page-head evt-rise" style={{ '--evt-i': 0 } as CSSProperties}>
        <div className="ui-page-head__text">
          <h1 className="ui-title evt-page__title">Events</h1>
          <p className="evt-ledger">
            <span className="evt-ledger__cell">
              <Counter value={upcomingThisMonth} className="evt-ledger__n" />
              <span className="evt-ledger__lab">this month</span>
            </span>
            <span className="evt-ledger__cell">
              <Counter value={upcomingEvents.length} className="evt-ledger__n" />
              <span className="evt-ledger__lab">upcoming</span>
            </span>
            {seesPast && (
              <span className="evt-ledger__cell">
                <Counter value={pastEvents.length} className="evt-ledger__n" />
                <span className="evt-ledger__lab">past</span>
              </span>
            )}
          </p>
        </div>

        <div className="ui-page-actions evt-page-actions">
          {allClubs.length > 0 && (
            <div className="evt-select">
              <label className="ui-visually-hidden" htmlFor="evt-club-filter">
                Filter by club
              </label>
              <select
                id="evt-club-filter"
                className="ui-field ui-field--select"
                value={selectedClubFilter}
                onChange={e => {
                  setSelectedClubFilter(e.target.value);
                  setSelectedDate(null);
                }}
              >
                <option value="all">All clubs · {events.length}</option>
                {allClubs.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Icon className="evt-i evt-i--sm">{MARK.down}</Icon>
            </div>
          )}

          <div className="ui-seg evt-view" role="group" aria-label="Calendar view">
            <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>
              Month
            </button>
            <button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>
              Agenda
            </button>
          </div>

          {canAddEvent && (
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={e => openForm(null, e.currentTarget)}
            >
              <Icon>{MARK.plus}</Icon>
              New event
            </button>
          )}
        </div>
      </header>

      {view === 'month' ? (
        <div className="evt-month">
          {/* Month grid */}
          <section className="ui-panel evt-cal evt-rise" style={{ '--evt-i': 1 } as CSSProperties} aria-labelledby="evt-cal-title">
            <header className="ui-panel__head evt-cal__head">
              <div className="evt-cal__id">
                <div className="ui-panel__titles">
                  <h2 id="evt-cal-title" className="ui-panel__title">
                    {monthLabel}
                  </h2>
                  <span className="ui-panel__meta">
                    {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
                <div className="evt-cal__marks">
                  <span className="evt-cal__marks-label">per week</span>
                  <WeekBars weeks={weekBuckets} />
                </div>
              </div>
              <div className="evt-cal__nav">
                <button
                  type="button"
                  className="ui-icon-btn"
                  aria-label="Previous month"
                  onClick={() => goToMonth(-1)}
                >
                  <Icon>{MARK.left}</Icon>
                </button>
                <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={goToToday}>
                  Today
                </button>
                <button
                  type="button"
                  className="ui-icon-btn"
                  aria-label="Next month"
                  onClick={() => goToMonth(1)}
                >
                  <Icon>{MARK.right}</Icon>
                </button>
              </div>
            </header>

            <div className="evt-cal__scroll">
              <div className="evt-week" aria-hidden="true">
                {WEEKDAYS.map(day => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="evt-grid" key={monthKey}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`lead-${i}`} className="evt-cell evt-cell--blank" aria-hidden="true" />
                ))}

                {density.map(({ day, items }) => {
                  const date = new Date(year, month, day);
                  const key = dayKey(date);
                  return (
                    <DayCell
                      key={key}
                      date={date}
                      events={items}
                      level={densityLevel(items.length, dayPeak)}
                      isToday={todayKey === key}
                      isSelected={selectedKey === key}
                      onSelect={toggleDay}
                      onOpen={openDetail}
                    />
                  );
                })}

                {Array.from({ length: trailingBlank }).map((_, i) => (
                  <div key={`trail-${i}`} className="evt-cell evt-cell--blank" aria-hidden="true" />
                ))}
              </div>
            </div>
          </section>

          {/* Selected day / next up */}
          <div className="evt-rail">
            <aside className="ui-panel evt-side evt-rise" style={{ '--evt-i': 2 } as CSSProperties} aria-labelledby="evt-side-title">
              <header className="ui-panel__head">
                <div className="ui-panel__titles">
                  <h2 id="evt-side-title" className="ui-panel__title">
                    {sideTitle}
                  </h2>
                  <span className="ui-panel__meta">
                    <Counter value={sideCount} />{' '}
                    {selectedDate ? (sideCount === 1 ? 'event' : 'events') : 'upcoming'}
                  </span>
                </div>
                <div className="evt-side__marks">
                  {selectedDate && selectedRelative && (
                    <span className="evt-side__rel">{selectedRelative}</span>
                  )}
                  {selectedDate && (
                    <button
                      type="button"
                      className="ui-icon-btn"
                      aria-label="Clear selected day"
                      onClick={() => setSelectedDate(null)}
                    >
                      <Icon className="evt-i evt-i--sm">{MARK.close}</Icon>
                    </button>
                  )}
                </div>
              </header>

              <div className="evt-side__body" key={selectedKey ?? 'next'}>
                {selectedDate ? (
                  sideEvents.length > 0 ? (
                    <TicketList
                      events={sideEvents}
                      canManage={canManageEvent}
                      onOpen={openDetail}
                      onEdit={(evt, trigger) => openForm(evt, trigger)}
                    />
                  ) : (
                    sideEmpty
                  )
                ) : upcomingEvents.length > 0 ? (
                  groupByDay(upcomingEvents)
                    .slice(0, 3)
                    .map(group => (
                      <section key={group.key} className="evt-daygroup">
                        <DayNodeHead
                          date={group.date}
                          count={group.items.length}
                          today={todayDate}
                          isToday={Boolean(group.date && dayKey(group.date) === todayKey)}
                        />
                        <TicketList
                          events={group.items.slice(0, 5)}
                          canManage={canManageEvent}
                          onOpen={openDetail}
                          onEdit={(evt, trigger) => openForm(evt, trigger)}
                        />
                      </section>
                    ))
                ) : (
                  sideEmpty
                )}
              </div>
            </aside>
          </div>

          {clubsThisMonth.length > 0 && (
            <ClubsPanel
              clubs={clubsThisMonth}
              peak={clubPeak}
              selected={selectedClubFilter}
              onToggle={id =>
                setSelectedClubFilter(prev => (prev === id ? 'all' : id))
              }
            />
          )}
        </div>
      ) : (
        <div className="evt-agenda">
          <div className="evt-agenda__main">
            <section className="ui-panel evt-rise" style={{ '--evt-i': 1 } as CSSProperties} aria-labelledby="evt-agenda-title">
              <header className="ui-panel__head">
                <div className="ui-panel__titles">
                  <h2 id="evt-agenda-title" className="ui-panel__title">
                    Upcoming
                  </h2>
                  <span className="ui-panel__meta">
                    <Counter value={upcomingEvents.length} />{' '}
                    {upcomingEvents.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
              </header>

              {upcomingEvents.length > 0 ? (
                <div className="evt-agenda__body ui-panel__body--flush">
                  {groupByDay(upcomingEvents).map(group => (
                    <section key={group.key} className="evt-daygroup evt-daygroup--agenda">
                      <DayNodeHead
                        date={group.date}
                        count={group.items.length}
                        today={todayDate}
                        isToday={Boolean(group.date && dayKey(group.date) === todayKey)}
                      />
                      <TicketList
                        events={group.items}
                        canManage={canManageEvent}
                        onOpen={openDetail}
                        onEdit={(evt, trigger) => openForm(evt, trigger)}
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <div className="ui-panel__body">
                  <div className="evt-empty">
                    <span className="ui-empty__mark">
                      <KindGlyph kind="event" size={17} />
                    </span>
                    <p className="ui-empty__title">
                      {selectedClubFilter !== 'all' ? `No upcoming events from ${filteredClubName}` : 'No upcoming events'}
                    </p>
                    <p className="ui-empty__text">
                      {selectedClubFilter !== 'all'
                        ? 'Change the club filter to see the rest of the calendar.'
                        : 'Past events stay on the calendar.'}
                    </p>
                    {selectedClubFilter !== 'all' && (
                      <button type="button" className="ui-btn ui-btn--sm" onClick={showAllClubs}>
                        Show all clubs
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {seesPast && pastEvents.length > 0 && (
              <details className="evt-past evt-rise" style={{ '--evt-i': 3 } as CSSProperties}>
                <summary>
                  <Icon className="evt-i evt-i--sm evt-past__chev">{MARK.down}</Icon>
                  <span className="evt-past__label">Past events</span>
                  <span className="ui-count">{pastEvents.length}</span>
                </summary>
                <div className="evt-past__body">
                  {groupByDay(pastEvents).map(group => (
                    <section key={group.key} className="evt-daygroup evt-daygroup--agenda">
                      <DayNodeHead
                        date={group.date}
                        count={group.items.length}
                        today={todayDate}
                        isToday={false}
                      />
                      <TicketList
                        events={group.items}
                        canManage={canManageEvent}
                        onOpen={openDetail}
                        onEdit={(evt, trigger) => openForm(evt, trigger)}
                      />
                    </section>
                  ))}
                </div>
              </details>
            )}
          </div>

          {clubsThisMonth.length > 0 && (
            <ClubsPanel
              clubs={clubsThisMonth}
              peak={clubPeak}
              selected={selectedClubFilter}
              onToggle={id => setSelectedClubFilter(prev => (prev === id ? 'all' : id))}
            />
          )}
        </div>
      )}

      {/* Event detail — the ticket stub */}
      {detailEvent &&
        createPortal(
          <div className="evt-page evt-portal">
            <div
              className="ui-overlay"
              onMouseDown={e => {
                if (e.target === e.currentTarget) closeDetail();
              }}
            >
          <div
            className="ui-modal evt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evt-detail-title"
          >
            <header className="ui-modal__head evt-modal__head">
              <div className="evt-modal__id">
                <EventCrest
                  name={detailClub?.name || 'Department Club'}
                  logo={detailClub?.logo}
                  size={30}
                />
                <div className="evt-modal__idtext">
                  <h2 id="evt-detail-title" className="ui-h2">
                    {detailEvent.title}
                  </h2>
                  <p className="evt-modal__sub">
                    <span className="ui-truncate">{detailClub?.name || 'Department Club'}</span>
                    <span className="evt-dot" aria-hidden="true" />
                    <span className={`ui-tag${detailIsPast ? '' : ' is-positive'}`}>
                      {detailIsPast ? 'Past' : 'Upcoming'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="ui-icon-btn"
                aria-label="Close event details"
                onClick={closeDetail}
              >
                <Icon className="evt-i evt-i--sm">{MARK.close}</Icon>
              </button>
            </header>

            <div className="ui-modal__body evt-detail">
              {deleteError && (
                <p className="ui-notice ui-notice--error" role="alert">
                  <svg className="evt-i evt-i--sm" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.8v4.6M12 16.1v.2" />
                  </svg>
                  {deleteError}
                </p>
              )}

              <div className="evt-stub">
                <div className="evt-stub__date">
                  {detailDate ? (
                    <DateTile date={detailDate} size="lg" tone={detailIsPast ? 'plain' : 'accent'} />
                  ) : (
                    <span className="evt-stub__tbd">TBD</span>
                  )}
                  <span className="evt-stub__time">
                    <Icon className="evt-i evt-i--xs">{MARK.clock}</Icon>
                    {detailDate ? timeLabel(detailDate) : 'Time TBD'}
                  </span>
                  {detailDate && <CountdownMark date={detailDate} today={todayDate} />}
                </div>

                <div className="evt-stub__body">
                  <span className="evt-stub__notch evt-stub__notch--top" aria-hidden="true" />
                  <span className="evt-stub__notch evt-stub__notch--bottom" aria-hidden="true" />

                  <dl className="evt-facts">
                    <div className="evt-fact">
                      <dt>
                        <Icon className="evt-i evt-i--xs">{MARK.pin}</Icon>
                        Venue
                      </dt>
                      <dd>{detailEvent.location || 'To be confirmed'}</dd>
                    </div>
                    <div className="evt-fact">
                      <dt>Organiser</dt>
                      <dd>
                        {detailOrganiser?.name || 'Not recorded'}
                        {detailOrganiser?.role
                          ? ` · ${String(detailOrganiser.role).replace(/_/g, ' ')}`
                          : ''}
                      </dd>
                    </div>
                    <div className="evt-fact">
                      <dt>Added</dt>
                      <dd>
                        {detailCreated && !Number.isNaN(detailCreated.getTime())
                          ? detailCreated.toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Not recorded'}
                      </dd>
                    </div>
                  </dl>

                  {detailEvent.description && (
                    <p className="evt-detail__desc">{detailEvent.description}</p>
                  )}

                  {(detailEvent.eventLink || detailEvent.relatedDocument?.url) && (
                    <div className="evt-detail__links">
                      {detailEvent.eventLink && (
                        <a
                          className="ui-btn ui-btn--quiet ui-btn--sm"
                          href={detailEvent.eventLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon className="evt-i evt-i--sm">{MARK.link}</Icon>
                          {detailEvent.eventLinkName?.trim() || 'Event link'}
                        </a>
                      )}
                      {detailEvent.relatedDocument?.url && (
                        <a
                          className="ui-btn ui-btn--quiet ui-btn--sm"
                          href={detailEvent.relatedDocument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon className="evt-i evt-i--sm">{MARK.file}</Icon>
                          {detailEvent.relatedDocumentName?.trim() ||
                            detailEvent.relatedDocument.originalName ||
                            'Related document'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {detailManage && (
              <footer className="ui-modal__foot">
                {confirmDelete ? (
                  <>
                    <p className="evt-confirm__text">Delete this event? This cannot be undone.</p>
                    <span className="ui-grow" />
                    <button
                      type="button"
                      className="ui-btn ui-btn--ghost"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn--danger"
                      onClick={deleteEvent}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete event'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ui-btn ui-btn--danger ui-btn--sm"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Icon className="evt-i evt-i--sm">{MARK.trash}</Icon>
                      Delete
                    </button>
                    <span className="ui-grow" />
                    <button type="button" className="ui-btn ui-btn--quiet" onClick={closeDetail}>
                      Close
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn--primary"
                      onClick={e => openForm(detailEvent, e.currentTarget)}
                    >
                      Edit event
                    </button>
                  </>
                )}
              </footer>
            )}
          </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Create / edit */}
      {showForm &&
        canAddEvent &&
        createPortal(
          <div className="evt-page evt-portal">
            <div
              className="ui-overlay"
              onMouseDown={e => {
                if (e.target === e.currentTarget) closeForm();
              }}
            >
          <div
            className="ui-modal ui-modal--wide evt-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evt-form-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 id="evt-form-title" className="ui-h2">
                  {editingEvent ? 'Edit event' : 'New event'}
                </h2>
              </div>
              <button
                type="button"
                className="ui-icon-btn"
                aria-label="Close form"
                onClick={closeForm}
              >
                <Icon className="evt-i evt-i--sm">{MARK.close}</Icon>
              </button>
            </header>

            <EventForm
              availableClubs={myAssignedClubs}
              clubId={
                editingEvent
                  ? typeof editingEvent.clubId === 'object'
                    ? editingEvent.clubId?._id
                    : editingEvent.clubId
                  : myAssignedClubs.length === 1
                    ? myAssignedClubs[0]._id
                    : undefined
              }
              event={editingEvent}
              onSave={finishForm}
              onCancel={closeForm}
            />
          </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
