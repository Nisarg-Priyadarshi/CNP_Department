import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EventForm } from '../../components/events/EventForm';
import { DateTile } from '../../components/ui/vis';

/* ═══════════════════════════════════════════════════════════════════════════
   Shared pieces for the four staff dashboards. The role screens own their
   composition; this file holds only marks, ages, the event rail and the
   per-role loading skeleton. No region here explains itself in a sentence.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Marks ───────────────────────────────────────────────────────────────── */

export type DashIconName =
  | 'clubs'
  | 'queue'
  | 'calendar'
  | 'users'
  | 'ops'
  | 'alert'
  | 'box'
  | 'arrow'
  | 'external'
  | 'bell'
  | 'check'
  | 'plus'
  | 'lead';

const DASH_ICONS: Record<DashIconName, ReactNode> = {
  clubs: (
    <>
      <path d="M3 20h18" />
      <path d="M5 20V10l7-5 7 5v10" />
      <path d="M9.5 20v-5h5v5" />
      <path d="M9 11h.01M15 11h.01" />
    </>
  ),
  queue: (
    <>
      <path d="M4 5h16" />
      <path d="M4 12h10" />
      <path d="M4 19h7" />
      <path d="M17 15l3 3-3 3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  users: (
    <>
      <path d="M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2" />
      <path d="M20 20v-1.4a3.5 3.5 0 0 0-2.4-3.2" />
    </>
  ),
  ops: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" />
      <path d="m5.6 5.6 1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  box: (
    <>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="m20 4-8.5 8.5" />
      <path d="M19 14v5H5V5h5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5.5-2 6.5-2 6.5h16s-2-1-2-6.5" />
      <path d="M10.4 19a2 2 0 0 0 3.2 0" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  lead: (
    <>
      <path d="M6.4 3.4v17.2" />
      <path d="M6.4 4.6h11.2l-2.6 3.6 2.6 3.6H6.4" />
    </>
  ),
};

export function DashIcon({ name, size = 16 }: { name: DashIconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DASH_ICONS[name]}
    </svg>
  );
}

/* ── People ──────────────────────────────────────────────────────────────── */

/**
 * An organisation's plate: the same cut-corner, hairline and letterform the club
 * crest and the project plate use, so a club looks like a club on every page.
 * People keep the round `ui-avatar`; this is only for clubs and projects.
 */
export function DashPlate({
  name,
  src,
  size = 40,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
}) {
  const cleaned = (name || '')
    .replace(/\b(club|society|committee|association|collective|group|cell)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = (cleaned || (name || '').trim()).split(/\s+/).filter(Boolean);
  const mono = words.length === 0
    ? '?'
    : words.length === 1
      ? words[0].slice(0, 2).toUpperCase()
      : (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();

  return (
    <span className="dash-plate" style={{ '--dash-plate': `${size}px` } as CSSProperties} aria-hidden="true">
      {src ? <img src={src} alt="" /> : <span className="dash-plate__mono">{mono}</span>}
    </span>
  );
}

export function DashAvatar({
  name,
  src,
  size = 'md',
}: {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const trimmed = (name || '').trim();
  const withoutTitle = trimmed.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '');
  const initial = (withoutTitle || trimmed || '?').charAt(0).toUpperCase() || '?';
  return (
    <span
      className={`ui-avatar${size === 'sm' ? ' ui-avatar--sm' : size === 'lg' ? ' ui-avatar--lg' : ''}`}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : initial}
    </span>
  );
}

/* ── Head actions ────────────────────────────────────────────────────────── */

export function DashNotifications({ count }: { count: number }) {
  return (
    <Link to="/notifications" className="ui-btn ui-btn--quiet">
      <DashIcon name="bell" />
      Notifications
      {count > 0 ? <span className="ui-count ui-count--accent">{count}</span> : null}
    </Link>
  );
}

/* ── Empty ───────────────────────────────────────────────────────────────── */

export function DashEmpty({
  icon,
  title,
  text,
  action,
}: {
  icon: DashIconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <span className="ui-empty__mark" aria-hidden="true">
        <DashIcon name={icon} size={15} />
      </span>
      <p className="ui-empty__title">{title}</p>
      {text ? <p className="ui-empty__text">{text}</p> : null}
      {action}
    </div>
  );
}

/* ── Quiet empty (inside a panel, so it adds no second border) ───────────── */

export function DashQuiet({
  icon,
  title,
  text,
  action,
}: {
  icon: DashIconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="dash-quiet">
      <span className="dash-quiet__mark" aria-hidden="true">
        <DashIcon name={icon} size={15} />
      </span>
      <div className="dash-quiet__text">
        <p className="dash-quiet__title">{title}</p>
        {text ? <p className="dash-quiet__line">{text}</p> : null}
      </div>
      {action ? <span className="dash-quiet__action">{action}</span> : null}
    </div>
  );
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

export function DashLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="ui-notice ui-notice--error" role="alert">
      <DashIcon name="alert" size={17} />
      <div className="ui-grow">
        <p>{message}</p>
      </div>
      <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* ── Dates ───────────────────────────────────────────────────────────────── */

export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "31 Oct 2026" */
export function fmtDay(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (!date) return 'Date to be confirmed';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "31 Oct" — for a tight stat value. */
export function fmtShortDay(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Age in days, floored at 0. `null` when the date is missing or invalid. */
export function ageInDays(value: string | Date | null | undefined): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** "3h" / "2d" — a mark, not a sentence. */
export function shortAge(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  const hours = Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
  if (hours < 1) return 'now';
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** The sentence form, for the accessible name and the tooltip only. */
export function spokenAge(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (!date) return 'Date unknown';
  const hours = Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
  if (hours < 1) return 'Less than an hour ago';
  if (hours < 24) return `${Math.floor(hours)} ${Math.floor(hours) === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/* ── Entrance choreography ───────────────────────────────────────────────── */

/**
 * The screen's only mount animation: regions rise 6px and fade over 260ms on a
 * 40ms stagger, capped at eight. Lists inside a region do not animate per row.
 */
export function riseStyle(index: number): CSSProperties {
  return { '--dash-i': Math.min(index, 8) } as CSSProperties;
}

/* ── Event rail ──────────────────────────────────────────────────────────── */

function EventSlip({
  event,
  past,
  first,
  onEdit,
  onDelete,
}: {
  event: any;
  past: boolean;
  first: boolean;
  onEdit: (event: any) => void;
  onDelete: (id: string) => void;
}) {
  const raw = event.eventDate || event.date;
  const date = parseDate(raw);
  const fullDate = fmtDay(raw);
  const club = event.clubId && typeof event.clubId === 'object' ? event.clubId : null;
  const time = date
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <li className={`ui-row dash-ev${past ? ' is-past' : ''}`}>
      <DateTile date={raw || new Date()} size="sm" tone={first && !past ? 'accent' : 'plain'} />

      <div className="dash-ev__main">
        <p className="dash-ev__title">{event.title || 'Untitled event'}</p>
        <p className="dash-ev__meta">
          <span className="ui-visually-hidden">{fullDate}. </span>
          {club?.name || 'Department club'}
          {event.location ? (
            <>
              <span className="dash-ev__dot" aria-hidden="true" />
              {event.location}
            </>
          ) : null}
        </p>
      </div>

      {time ? <span className="dash-ev__time">{time}</span> : null}

      <div className="ui-row__actions dash-ev__actions">
        {event.eventLink ? (
          <a
            className="ui-icon-btn"
            href={event.eventLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open the link for ${event.title || 'this event'}`}
            title="Event link"
          >
            <DashIcon name="external" />
          </a>
        ) : null}
        {event.relatedDocument?.url ? (
          <a
            className="ui-icon-btn"
            href={event.relatedDocument.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open the document for ${event.title || 'this event'}`}
            title="Related document"
          >
            <DashIcon name="box" />
          </a>
        ) : null}
        <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => onEdit(event)}>
          Edit
        </button>
        <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={() => onDelete(event._id)}>
          Delete
        </button>
      </div>
    </li>
  );
}

export interface DashEventsPanelProps {
  idPrefix: string;
  upcoming: any[];
  past: any[];
  tab: 'upcoming' | 'past';
  onTab: (tab: 'upcoming' | 'past') => void;
  canAdd: boolean;
  showForm: boolean;
  editing: any | null;
  /** Fixed club for the form (coordinators create for their own clubs). */
  formClubId?: string;
  /** Offer a club selector in the form (club admin manages every club). */
  availableClubs?: any[];
  onAdd: () => void;
  onEdit: (event: any) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  limit?: number;
}

export function DashEventsPanel({
  idPrefix,
  upcoming,
  past,
  tab,
  onTab,
  canAdd,
  showForm,
  editing,
  formClubId,
  availableClubs,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  limit = 4,
}: DashEventsPanelProps) {
  const list = tab === 'upcoming' ? upcoming : past;
  const shown = list.slice(0, limit);
  const hidden = list.length - shown.length;

  return (
    <section className="ui-panel dash-events" aria-labelledby={`${idPrefix}-title`}>
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title" id={`${idPrefix}-title`}>
            {showForm ? (editing ? 'Edit event' : 'New event') : 'Events'}
          </h2>
          {showForm ? null : (
            <span className="ui-panel__meta">
              {upcoming.length + past.length}
            </span>
          )}
        </div>
        <div className="dash-head-actions">
          {!showForm && (
            <Link to="/events" className="ui-btn ui-btn--ghost ui-btn--sm">
              All events
            </Link>
          )}
          {canAdd && !showForm ? (
            <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={onAdd}>
              <DashIcon name="plus" size={14} />
              New event
            </button>
          ) : null}
        </div>
      </header>

      {showForm ? (
        <div className="ui-panel__body ui-panel__body--flush">
          <EventForm
            clubId={formClubId}
            availableClubs={availableClubs}
            event={editing}
            onSave={onSave}
            onCancel={onCancel}
          />
        </div>
      ) : (
        <>
          <div className="dash-tabbar">
            <div className="ui-tabs" role="tablist" aria-label="Club events">
              <button
                type="button"
                role="tab"
                id={`${idPrefix}-tab-upcoming`}
                aria-selected={tab === 'upcoming'}
                aria-controls={`${idPrefix}-panel`}
                className={tab === 'upcoming' ? 'is-active' : ''}
                onClick={() => onTab('upcoming')}
              >
                Upcoming
                <span className="ui-tabs__count">{upcoming.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                id={`${idPrefix}-tab-past`}
                aria-selected={tab === 'past'}
                aria-controls={`${idPrefix}-panel`}
                className={tab === 'past' ? 'is-active' : ''}
                onClick={() => onTab('past')}
              >
                Past
                <span className="ui-tabs__count">{past.length}</span>
              </button>
            </div>
          </div>

          <div
            id={`${idPrefix}-panel`}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-tab-${tab}`}
            className="ui-panel__body ui-panel__body--flush"
          >
            {shown.length ? (
              <ul className="dash-ev-rail">
                {shown.map((event, index) => (
                  <EventSlip
                    key={event._id}
                    event={event}
                    past={tab === 'past'}
                    first={index === 0}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            ) : (
              <div className="ui-panel__body">
                <DashQuiet
                  icon="calendar"
                  title={tab === 'upcoming' ? 'No upcoming events' : 'No past events'}
                  text={
                    tab === 'upcoming'
                      ? 'Events created for these clubs will appear here.'
                      : 'Events move here after their date has passed.'
                  }
                  action={
                    canAdd && tab === 'upcoming' ? (
                      <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={onAdd}>
                        <DashIcon name="plus" size={14} />
                        New event
                      </button>
                    ) : undefined
                  }
                />
              </div>
            )}
          </div>

          {hidden > 0 ? (
            <footer className="ui-panel__foot">
              <span className="dash-at">
                {hidden} more {tab} event{hidden === 1 ? '' : 's'}
              </span>
              <Link to="/events" className="ui-btn ui-btn--ghost ui-btn--sm">
                Open events
              </Link>
            </footer>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ── Loading skeleton ────────────────────────────────────────────────────── */

function Skel({ className }: { className: string }) {
  return <span className={`ui-skel dash-skel ${className}`} />;
}

/**
 * The loading state is shaped like the screen it becomes: each role's own
 * composition, not a full-screen loader. The shell's route rail covers the
 * global "a route is loading" affordance.
 */
export function DashSkeleton({ role }: { role?: string }) {
  return (
    <div className={`dash dash--loading dash--${role ?? 'staff'}`} aria-busy="true">
      <div className="ui-page-head">
        <div className="ui-page-head__text dash-skel-head">
          <Skel className="dash-skel--title" />
          <Skel className="dash-skel--sub" />
        </div>
        <div className="dash-head-actions">
          <Skel className="dash-skel--key" />
          <Skel className="dash-skel--key" />
        </div>
      </div>

      {role === 'faculty_coordinator' ? (
        <>
          <div className="dash-tiles">
            <Skel className="dash-skel--tile" />
            <Skel className="dash-skel--tile" />
          </div>
          <div className="dash-split">
            <Skel className="dash-skel--panel" />
            <Skel className="dash-skel--panel-sm" />
          </div>
          <Skel className="dash-skel--rail" />
        </>
      ) : null}

      {role === 'club_admin' ? (
        <>
          <Skel className="dash-skel--band" />
          <div className="dash-map">
            <Skel className="dash-skel--tile" />
            <Skel className="dash-skel--tile" />
            <Skel className="dash-skel--tile" />
          </div>
          <Skel className="dash-skel--rail" />
        </>
      ) : null}

      {role === 'faculty_mentor' ? (
        <>
          <div className="dash-const">
            <Skel className="dash-skel--node" />
            <Skel className="dash-skel--node" />
          </div>
          <Skel className="dash-skel--band" />
        </>
      ) : null}

      {role === 'project_admin' ? (
        <>
          <div className="dash-console">
            <Skel className="dash-skel--cell" />
            <Skel className="dash-skel--cell" />
            <Skel className="dash-skel--cell" />
            <Skel className="dash-skel--cell" />
          </div>
          <div className="dash-split">
            <Skel className="dash-skel--panel" />
            <Skel className="dash-skel--panel-sm" />
          </div>
          <div className="dash-caps">
            <Skel className="dash-skel--cap" />
            <Skel className="dash-skel--cap" />
            <Skel className="dash-skel--cap" />
            <Skel className="dash-skel--cap" />
            <Skel className="dash-skel--cap" />
          </div>
        </>
      ) : null}

      <p className="ui-visually-hidden" role="status">
        Loading dashboard
      </p>
    </div>
  );
}
