import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { usePageLoading } from '../../context/LoadingContext';
import { Counter, KindGlyph } from '../../components/ui/vis';
import type { Kind } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import './notifications.css';

interface NotificationMetadata {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  department?: string;
  semester?: number | string;
  status?: string;
  requestDate?: string;
  projectId?: string;
  projectName?: string;
  clubId?: string;
  clubName?: string;
  entityName?: string;
  quantity?: number;
  source?: string;
  hasAttachments?: boolean;
  attachmentCount?: number;
  creationTime?: string;
  submissionTime?: string;
  reason?: string;
  feedbackText?: string;
  action?: string;
}

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  link?: string;
  actionText?: string;
  metadata?: NotificationMetadata;
  isRead: boolean;
  createdAt: string;
}

/* ── Tool marks. Entity glyphs come from the shared set; these are chrome. ── */

type MarkName = 'check' | 'checkAll' | 'arrow' | 'arrowLeft' | 'filter' | 'caret' | 'quantity' | 'attachment';

const MARKS: Record<MarkName, ReactNode> = {
  check: <path d="m5 12.6 4.4 4.4L19 7.2" />,
  checkAll: (
    <>
      <path d="m2.8 12.4 3.9 3.9 6.9-6.9" />
      <path d="m10.4 16.3 1.6 1.6L21.6 8.3" />
    </>
  ),
  arrow: (
    <>
      <path d="M4.4 12h14.2" />
      <path d="m12.8 6.2 5.8 5.8-5.8 5.8" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19.6 12H5.4" />
      <path d="M11.2 6.2 5.4 12l5.8 5.8" />
    </>
  ),
  filter: <path d="M3.6 5.6h16.8l-6.6 7.5v5.3l-3.6 2v-7.3L3.6 5.6Z" />,
  caret: <path d="m8.2 10.4 3.8 3.8 3.8-3.8" />,
  quantity: <path d="M7 7l10 10M17 7 7 17" />,
  attachment: (
    <path d="M18.4 10.2 11 17.6a4 4 0 0 1-5.7-5.7l8-8a2.7 2.7 0 0 1 3.8 3.8l-8 8a1.4 1.4 0 0 1-2-2l7.4-7.4" />
  ),
};

function Mark({ name, size = 16 }: { name: MarkName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {MARKS[name]}
    </svg>
  );
}

/* ── Derivation: family, state, title. All display only. ─────────────────── */

type Family = 'request' | 'club' | 'project' | 'event' | 'system';

const FAMILY_ORDER: Family[] = ['request', 'club', 'project', 'event', 'system'];

const FAMILY_LABEL: Record<Family, string> = {
  request: 'Requests',
  club: 'Clubs',
  project: 'Projects',
  event: 'Events',
  system: 'System',
};

/** The glyph set reads "club" the same way here as everywhere else in the app. */
const FAMILY_KIND: Record<Family, Kind> = {
  request: 'request',
  club: 'club',
  project: 'project',
  event: 'event',
  system: 'system',
};

function familyOf(type: string): Family {
  // MOCK: the payload carries `type` but no taxonomy — the five marks are derived here.
  if (type.includes('join_request') || type.startsWith('material_request')) return 'request';
  if (type.startsWith('club_')) return 'club';
  if (type.startsWith('event_')) return 'event';
  if (type.startsWith('project_') || type === 'mentor_assigned' || type === 'material_added') {
    return 'project';
  }
  return 'system';
}

function stateOf(type: string): 'is-positive' | 'is-negative' | null {
  if (type.includes('rejected')) return 'is-negative';
  if (type.includes('approved')) return 'is-positive';
  return null;
}

function titleFor(n: NotificationItem): string {
  if (n.type === 'club_join_request' && (!n.title || n.title.includes('Join Request'))) {
    return 'New Club Join Request';
  }
  if (n.type === 'project_join_request' && (!n.title || n.title.includes('Join Request'))) {
    return 'New Project Join Request';
  }
  return n.title;
}

function bodyFor(n: NotificationItem): string {
  return (
    n.message ||
    (n.type === 'club_join_request'
      ? 'A student has requested to join this club.'
      : n.type === 'project_join_request'
        ? 'A student has requested to join this project.'
        : '')
  );
}

function kindFor(n: NotificationItem): string {
  if (n.title.toLowerCase().includes('feedback')) return 'Mentor feedback';
  switch (n.type) {
    case 'material_request_submitted':
    case 'material_request_created':
    case 'material_request':
      return 'Material request';
    case 'material_request_approved':
      return 'Material approved';
    case 'material_request_rejected':
      return 'Material rejected';
    case 'material_added':
    case 'project_material_added':
      return 'Material added';
    case 'club_join_request':
    case 'project_join_request':
      return 'Join request';
    case 'club_join_approved':
    case 'project_join_approved':
      return 'Request approved';
    case 'club_join_rejected':
    case 'project_join_rejected':
      return 'Request rejected';
    case 'mentor_assigned':
      return 'Mentorship';
    case 'event_created':
      return 'New event';
    case 'event_reminder':
      return 'Event reminder';
    case 'project_update':
      return 'Project update';
    default:
      return n.type
        .split('_')
        .join(' ')
        .replace(/^./, (c) => c.toUpperCase());
  }
}

/* ── Time: day buckets, a quiet relative label, a 14-day volume window. ───── */

const DAY_MS = 86400000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayOffset(base: number, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function shortDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

type Bucket = 'today' | 'yesterday' | 'earlier';

function bucketOf(iso: string): Bucket {
  const at = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  if (at >= today) return 'today';
  if (at >= today - DAY_MS) return 'yesterday';
  return 'earlier';
}

const BUCKET_LABEL: Record<Bucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
};

function relativeLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  const bucket = bucketOf(iso);
  if (bucket === 'today') return `${Math.floor(diff / 3600000)}h`;
  if (bucket === 'yesterday') {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function exactTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceLabel(source: string): string {
  if (source === 'self_purchased') return 'Self-purchased';
  if (source === 'owned') return 'Owned';
  return source;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The message and the quoted reason/feedback are the same sentence in most payloads.
 * Split them once so the record shows the context as a note (only where it carries
 * something the fact grid does not) and the mentor's or reviewer's words as a quote.
 */
function paneBody(n: NotificationItem): { lead: string; quotes: Array<{ label: string; text: string; negative: boolean }> } {
  const md = n.metadata || {};
  const quotes: Array<{ label: string; text: string; negative: boolean }> = [];
  if (md.feedbackText) quotes.push({ label: 'Feedback note', text: md.feedbackText, negative: false });
  if (md.reason) {
    quotes.push({
      label: n.type === 'material_request_rejected' ? 'Rejection reason' : 'Request reason',
      text: md.reason,
      negative: n.type === 'material_request_rejected',
    });
  }
  let lead = bodyFor(n);
  const first = quotes.find((q) => lead.includes(q.text));
  if (first) {
    const at = lead.indexOf(first.text);
    const rest = lead.slice(at + first.text.length).replace(/^["'”’.\s]+$/, '');
    if (at > 0 && rest.length === 0) {
      lead = lead
        .slice(0, at)
        .trim()
        .replace(/[:\s]["'“”‘’]$/, '')
        .trim()
        .replace(/[:\s]+$/, '')
        .replace(/\s+reason$/i, '')
        .replace(/[.:\s]+$/, '');
    }
  }
  return { lead, quotes };
}

/* ── Row meta: the facts as one line, never the sentence. ─────────────────── */

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

/** A sentence that only repeats the title's own words adds nothing to the row. */
function repeatsTitle(n: NotificationItem, text: string): boolean {
  const title = new Set(significantWords(titleFor(n)));
  const words = significantWords(text);
  if (words.length === 0) return true;
  return words.filter((word) => title.has(word)).length >= words.length * 0.6;
}

function metaParts(n: NotificationItem): string[] {
  // MOCK: `GET /notifications` ships one prose `message`; the scanning line is assembled
  // from the metadata fields the payload already carries. No field is invented.
  const md = n.metadata || {};
  const title = titleFor(n).toLowerCase();
  const fresh = (part: string) => part.length > 0 && !title.includes(part.toLowerCase());
  const parts: string[] = [];
  const quantity = typeof md.quantity === 'number' && md.quantity > 0 ? `× ${md.quantity}` : '';
  if (md.entityName && fresh(md.entityName)) {
    parts.push(quantity ? `${md.entityName} ${quantity}` : md.entityName);
  }
  const place = md.projectName || md.clubName;
  const incoming = n.type.includes('join_request') || n.type.endsWith('_submitted') || n.type.endsWith('_created');
  if (!md.entityName && incoming && md.actorName) parts.push(md.actorName);
  if (place) parts.push(place);
  if (!md.entityName && !incoming && md.actorName) parts.push(md.actorName);
  if (parts.length === 0) {
    const message = bodyFor(n);
    if (message && !repeatsTitle(n, message)) parts.push(message);
  }
  return parts.slice(0, 2);
}


/* ── Record facts: glyph + label + value. ─────────────────────────────────── */

type FactIcon = Kind | 'quantity' | 'attachment';

interface Fact {
  label: string;
  value: string;
  icon?: FactIcon;
}

function FactMark({ icon }: { icon?: FactIcon }) {
  if (!icon) return <span className="ntf-fact__dot" aria-hidden="true" />;
  if (icon === 'quantity' || icon === 'attachment') {
    return <Mark name={icon} size={15} />;
  }
  return <KindGlyph kind={icon} size={15} />;
}

function factsFor(n: NotificationItem): Fact[] {
  const md = n.metadata || {};
  const facts: Fact[] = [];
  const isMaterial = n.type.startsWith('material_') || n.type.includes('material_added');
  if (md.projectName) facts.push({ label: 'Project', value: md.projectName, icon: 'project' });
  if (md.clubName) facts.push({ label: 'Club', value: md.clubName, icon: 'club' });
  if (md.entityName) {
    facts.push(
      isMaterial
        ? { label: 'Item', value: md.entityName, icon: 'inventory' }
        : { label: 'Update', value: md.entityName, icon: 'update' },
    );
  }
  if (md.quantity) facts.push({ label: 'Quantity', value: `× ${md.quantity}`, icon: 'quantity' });
  if (md.actorName) facts.push({ label: 'From', value: md.actorName, icon: 'member' });
  if (md.status) facts.push({ label: 'Status', value: capitalise(md.status), icon: 'system' });
  if (md.requestDate) facts.push({ label: 'Requested', value: exactTime(md.requestDate), icon: 'event' });
  if (md.submissionTime) facts.push({ label: 'Submitted', value: exactTime(md.submissionTime), icon: 'event' });
  if (md.creationTime) facts.push({ label: 'Added', value: exactTime(md.creationTime), icon: 'event' });
  if (md.source) facts.push({ label: 'Source', value: sourceLabel(md.source), icon: 'inventory' });
  if (md.hasAttachments) {
    facts.push({ label: 'Attachments', value: String(md.attachmentCount || 1), icon: 'attachment' });
  }
  if (md.department) facts.push({ label: 'Department', value: md.department });
  if (md.semester) facts.push({ label: 'Semester', value: String(md.semester) });
  if (md.actorEmail) facts.push({ label: 'Email', value: md.actorEmail });
  return facts;
}

/* ── The page ────────────────────────────────────────────────────────────── */

export default function Notifications() {
  const navigate = useNavigate();
  const { setPageLoading } = usePageLoading();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [family, setFamily] = useState<'all' | Family>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readingOnNarrow, setReadingOnNarrow] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      setError(null);
      const res = await api<any>('GET', '/notifications');
      setNotifications(res.data || []);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err?.message || 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    // Filtering stays here by choice: `GET /notifications` accepts `type=` and
    // `status=`, but the page already holds the list, so filtering costs no round trip.
    const byRead = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;
    if (family === 'all') return byRead;
    return byRead.filter((n) => familyOf(n.type) === family);
  }, [notifications, filter, family]);

  const familiesPresent = useMemo(() => {
    const counts = new Map<Family, number>();
    notifications.forEach((n) => {
      const f = familyOf(n.type);
      counts.set(f, (counts.get(f) ?? 0) + 1);
    });
    return FAMILY_ORDER.filter((f) => counts.has(f)).map((f) => ({ family: f, count: counts.get(f) ?? 0 }));
  }, [notifications]);

  const groups = useMemo(() => {
    // MOCK: day buckets are derived from `createdAt`; the API returns a flat list.
    const buckets: Record<Bucket, NotificationItem[]> = { today: [], yesterday: [], earlier: [] };
    filteredNotifications.forEach((n) => buckets[bucketOf(n.createdAt)].push(n));
    return (['today', 'yesterday', 'earlier'] as Bucket[])
      .map((key) => ({ key, label: BUCKET_LABEL[key], items: buckets[key] }))
      .filter((g) => g.items.length > 0);
  }, [filteredNotifications]);

  /* Arrival rhythm: the real daily counts of the page, zero-filled. */
  const volume = useMemo(() => {
    // MOCK: `/notifications` returns no time series — the 14-day window is grouped here
    // from `createdAt`, with an explicit zero for every day nothing arrived.
    const days = 14;
    const today = startOfDay(new Date());
    const counts = Array.from({ length: days }, () => 0);
    for (const n of notifications) {
      const at = startOfDay(new Date(n.createdAt));
      const index = days - 1 - Math.round((today - at) / DAY_MS);
      if (index >= 0 && index < days) counts[index] += 1;
    }
    const labels = counts.map((count, i) => `${shortDay(dayOffset(today, i - (days - 1)))} · ${count}`);
    return {
      counts,
      labels,
      today: counts[days - 1],
      peak: counts.reduce((a, b) => Math.max(a, b), 0),
      window: counts.reduce((a, b) => a + b, 0),
    };
  }, [notifications]);

  const selected = useMemo(() => {
    return (
      filteredNotifications.find((n) => n._id === selectedId) ?? filteredNotifications[0] ?? null
    );
  }, [filteredNotifications, selectedId]);

  useEffect(() => {
    if (!typeMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setTypeMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTypeMenuOpen(false);
        filterBtnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [typeMenuOpen]);

  /* Escape leaves the narrow reading pane and puts focus back on its row. */
  useEffect(() => {
    if (!readingOnNarrow || typeMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setReadingOnNarrow(false);
      window.requestAnimationFrame(() => selectedRowRef.current?.focus());
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [readingOnNarrow, typeMenuOpen]);

  /* Read state is two-way: an inbox you can only empty is not a filing system.
     Both verbs return the stored record, so the row shows what was saved. */
  const setReadState = async (id: string, isRead: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api('PATCH', `/notifications/${id}/${isRead ? 'read' : 'unread'}`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead } : n)));
    } catch (err) {
      console.error(`Failed to mark notification as ${isRead ? 'read' : 'unread'}:`, err);
    }
  };

  const markRead = (id: string, e?: React.MouseEvent) => setReadState(id, true, e);
  const markUnread = (id: string, e?: React.MouseEvent) => setReadState(id, false, e);

  const markAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    try {
      setMarkingAll(true);
      await api('PATCH', '/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleAction = async (n: NotificationItem) => {
    if (!n.isRead) {
      markRead(n._id);
    }
    if (n.link) {
      if (n.link.startsWith('http://') || n.link.startsWith('https://')) {
        window.open(n.link, '_blank');
      } else {
        navigate(n.link);
      }
    }
  };

  const selectRow = (n: NotificationItem) => {
    setSelectedId(n._id);
    setReadingOnNarrow(true);
  };

  const resetFilters = () => {
    setFilter('all');
    setFamily('all');
    setReadingOnNarrow(false);
  };

  const total = notifications.length;
  const filtersActive = filter !== 'all' || family !== 'all';
  const isReading = Boolean(selected) && !loading && readingOnNarrow;
  const isEmpty = !loading && filteredNotifications.length === 0;
  const bodyClass = `${!loading && selected ? (isReading ? ' is-reading' : '') : ' is-solo'}${
    isEmpty ? ' is-empty' : ''
  }`;

  const record = selected ? paneBody(selected) : null;
  const facts = selected ? factsFor(selected) : [];
  /* The prose only survives where the grid cannot carry it: a record with two or more
     facts, or a quote, is already complete. Otherwise the sentence is the record. */
  const showNote = Boolean(record?.lead) && facts.length < 2 && (record?.quotes.length ?? 0) === 0;

  const volumeAria =
    volume.window === 0
      ? 'No notifications in the last 14 days'
      : `${volume.window} ${volume.window === 1 ? 'notification' : 'notifications'} in the last 14 days, ${volume.today} today`;

  return (
    <div className="ntf">
      <header className="ui-page-head ntf-pagehead">
        <div className="ui-page-head__text">
          <div className="ntf-headline">
            <h1 className="ui-title">Notifications</h1>
            {unreadCount > 0 && (
              <Tooltip label={`${unreadCount} unread of ${total}`}>
                <span className="ui-count ui-count--accent">
                  <Counter value={unreadCount} />
                  <span className="ui-visually-hidden"> unread</span>
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="ui-page-actions">
          <button
            type="button"
            className="ui-btn ui-btn--quiet ui-btn--sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || markingAll}
          >
            <Mark name="checkAll" size={14} />
            {markingAll ? 'Marking all read' : 'Mark all read'}
          </button>
        </div>
      </header>

      {error ? (
        <div className="ntf-error">
          <div className="ui-notice ui-notice--error" role="alert">
            <span>{error}</span>
          </div>
          <div className="ntf-error__actions">
            <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={fetchNotifications}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <section className={`ui-panel ntf-inbox${isReading ? ' is-reading' : ''}`} aria-label="Notification inbox">
          <div className="ntf-bar">
            <div className="ntf-filters">
              <div className="ui-seg ntf-seg" role="group" aria-label="Filter by read state">
                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                  <span>All</span>
                  <span className="ntf-seg__count">{total}</span>
                </button>
                <button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
                  <span>Unread</span>
                  <span className="ntf-seg__count">{unreadCount}</span>
                </button>
              </div>

              <div className="ntf-filter" ref={filterRef}>
                <button
                  type="button"
                  ref={filterBtnRef}
                  className="ui-btn ui-btn--quiet ui-btn--sm"
                  aria-haspopup="menu"
                  aria-expanded={typeMenuOpen}
                  onClick={() => setTypeMenuOpen((open) => !open)}
                >
                  <Mark name="filter" size={13} />
                  {family === 'all' ? 'All types' : FAMILY_LABEL[family]}
                  <Mark name="caret" size={13} />
                </button>
                {typeMenuOpen && (
                  <div className="ui-menu ntf-menu" role="menu" aria-label="Filter by type">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={family === 'all'}
                      className="ui-menu__item"
                      onClick={() => {
                        setFamily('all');
                        setTypeMenuOpen(false);
                      }}
                    >
                      <span className="ntf-menu__tick" aria-hidden="true">
                        <Mark name="check" size={13} />
                      </span>
                      <span className="ntf-menu__label">All types</span>
                      <span className="ntf-menu__bar" aria-hidden="true">
                        <span style={{ '--ntf-f': 1 } as CSSProperties} />
                      </span>
                      <span className="ntf-menu__count">{total}</span>
                    </button>
                    {familiesPresent.map(({ family: f, count }) => (
                      <button
                        key={f}
                        type="button"
                        role="menuitemradio"
                        aria-checked={family === f}
                        className="ui-menu__item"
                        title={`${FAMILY_LABEL[f]} · ${count} of ${total}`}
                        onClick={() => {
                          setFamily(f);
                          setTypeMenuOpen(false);
                        }}
                      >
                        <span className="ntf-menu__tick" aria-hidden="true">
                          <Mark name="check" size={13} />
                        </span>
                        <span className="ntf-menu__label">{FAMILY_LABEL[f]}</span>
                        <span className="ntf-menu__bar" aria-hidden="true">
                          <span style={{ '--ntf-f': total > 0 ? count / total : 0 } as CSSProperties} />
                        </span>
                        <span className="ntf-menu__count">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {total > 0 && (
              <Tooltip
                label={`${volumeAria} · busiest day ${volume.peak}`}
                side="bottom"
              >
                <div className="ntf-vol" role="img" aria-label={volumeAria}>
                  <span className="ntf-vol__days" aria-hidden="true">
                    {volume.counts.map((count, i) => (
                      <span
                        key={i}
                        className="ntf-vol__day"
                        data-today={i === volume.counts.length - 1 || undefined}
                        data-empty={count === 0 || undefined}
                        title={volume.labels[i]}
                        style={
                          { '--ntf-f': volume.peak > 0 ? count / volume.peak : 0 } as CSSProperties
                        }
                      />
                    ))}
                  </span>
                  <span className="ntf-vol__total">
                    <Counter value={volume.today} />
                    <span className="ntf-vol__cap">today</span>
                  </span>
                </div>
              </Tooltip>
            )}
          </div>

          <div className={`ntf-body${bodyClass}`}>
            <div className="ntf-column">
              {loading ? (
                <>
                  <p className="ui-visually-hidden">Loading notifications</p>
                  <div className="ntf-skel" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="ntf-skel__row">
                        <span className="ui-skel ntf-skel__mark" />
                        <span className="ntf-skel__lines">
                          <span className="ui-skel ntf-skel__title" />
                          <span className="ui-skel ntf-skel__body" />
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : filteredNotifications.length === 0 ? (
                <div className="ui-empty ntf-empty">
                  <span className="ui-empty__mark">
                    <Mark name="check" size={15} />
                  </span>
                  {total === 0 ? (
                    <>
                      <p className="ui-empty__title">Inbox empty</p>
                      <p className="ui-empty__text">Nothing has arrived yet.</p>
                      <div className="ntf-empty__actions">
                        <Link className="ui-btn ui-btn--sm" to="/dashboard">
                          Back to dashboard
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="ui-empty__title">
                        {filter === 'unread' ? 'All caught up' : 'Nothing of this type'}
                      </p>
                      <p className="ui-empty__text">
                        {filter === 'unread' ? 'Every notification is read.' : 'No notifications of this type.'}
                      </p>
                      <div className="ntf-empty__actions">
                        {filtersActive ? (
                          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={resetFilters}>
                            Show all notifications
                          </button>
                        ) : (
                          <Link className="ui-btn ui-btn--sm" to="/dashboard">
                            Back to dashboard
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <ul className="ntf-list">
                  {groups.map((group) => {
                    const groupUnread = group.items.filter((n) => !n.isRead).length;
                    return (
                      <li key={group.key} className="ntf-group">
                        <h2 className="ntf-day">
                          <span className="ntf-day__label">{group.label}</span>
                          <span className="ntf-day__count">{group.items.length}</span>
                          <span className="ui-visually-hidden">
                            {groupUnread > 0
                              ? `, ${groupUnread} unread`
                              : ', all read'}
                          </span>
                        </h2>
                        <ul>
                          {group.items.map((n, index) => {
                            const fam = familyOf(n.type);
                            const state = stateOf(n.type);
                            const isSelected = selected?._id === n._id;
                            const parts = metaParts(n);
                            return (
                              <li
                                key={n._id}
                                className={`ntf-row${n.isRead ? '' : ' is-unread'}${
                                  isSelected ? ' is-selected' : ''
                                }`}
                                style={{ '--ntf-i': Math.min(index, 7) } as CSSProperties}
                              >
                                <button
                                  type="button"
                                  className="ntf-row__hit"
                                  aria-current={isSelected ? 'true' : undefined}
                                  onClick={() => selectRow(n)}
                                  ref={isSelected ? selectedRowRef : undefined}
                                >
                                  <span className="ntf-row__flag" aria-hidden="true" />
                                  <span className={`ntf-mark${state ? ` ${state}` : ''}`} aria-hidden="true">
                                    <KindGlyph kind={FAMILY_KIND[fam]} size={20} />
                                  </span>
                                  <span className="ntf-row__text">
                                    <span className="ntf-row__title">
                                      <span className="ui-visually-hidden">
                                        {n.isRead ? 'Read: ' : 'Unread: '}
                                      </span>
                                      {titleFor(n)}
                                    </span>
                                    <span className="ntf-row__meta">
                                      {parts.map((part, i) => (
                                        <span key={`${part}-${i}`} className="ntf-row__part">
                                          {i > 0 && <span className="ntf-row__dot" aria-hidden="true" />}
                                          {part}
                                        </span>
                                      ))}
                                    </span>
                                  </span>
                                </button>
                                <span className="ntf-row__aside">
                                  <span className="ntf-row__time" title={exactTime(n.createdAt)}>
                                    {relativeLabel(n.createdAt)}
                                  </span>
                                  <span className="ntf-row__tools">
                                    <button
                                      type="button"
                                      className="ntf-tool"
                                      aria-label={`Mark "${titleFor(n)}" as ${n.isRead ? 'unread' : 'read'}`}
                                      title={n.isRead ? 'Mark as unread' : 'Mark as read'}
                                      onClick={(e) =>
                                        n.isRead ? markUnread(n._id, e) : markRead(n._id, e)
                                      }
                                    >
                                      <Mark name={n.isRead ? 'arrowLeft' : 'check'} size={14} />
                                    </button>
                                    {n.link && (
                                      <button
                                        type="button"
                                        className="ntf-tool"
                                        aria-label={`Open "${titleFor(n)}"`}
                                        title={n.actionText || 'Open'}
                                        onClick={() => handleAction(n)}
                                      >
                                        <Mark name="arrow" size={14} />
                                      </button>
                                    )}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selected && !loading && (
              <aside className="ntf-pane" aria-label="Selected notification">
                <article className="ntf-record" key={selected._id}>
                  <button type="button" className="ntf-back" onClick={() => setReadingOnNarrow(false)}>
                    <Mark name="arrowLeft" size={14} />
                    Inbox
                  </button>

                  <header className="ntf-record__head">
                    <span
                      className={`ntf-plate${stateOf(selected.type) ? ` ${stateOf(selected.type)}` : ''}`}
                      aria-hidden="true"
                    >
                      <KindGlyph kind={FAMILY_KIND[familyOf(selected.type)]} size={24} />
                    </span>
                    <div className="ntf-record__ident">
                      <p className="ntf-record__kind">
                        <span>{kindFor(selected)}</span>
                        <span className="ntf-sep" aria-hidden="true" />
                        <time dateTime={selected.createdAt}>{exactTime(selected.createdAt)}</time>
                      </p>
                      <h2 className="ntf-record__title">{titleFor(selected)}</h2>
                    </div>
                    <span className={`ntf-state${selected.isRead ? '' : ' is-unread'}`}>
                      <span className="ntf-state__tick" aria-hidden="true" />
                      {selected.isRead ? 'Read' : 'Unread'}
                    </span>
                  </header>

                  {showNote && record?.lead && <p className="ntf-record__note">{record.lead}</p>}

                  {facts.length > 0 && (
                    <dl className="ntf-grid">
                      {facts.map((fact) => (
                        <div className="ntf-fact" key={`${fact.label}-${fact.value}`}>
                          <dt className="ntf-fact__label">
                            <span className="ntf-fact__mark" aria-hidden="true">
                              <FactMark icon={fact.icon} />
                            </span>
                            {fact.label}
                          </dt>
                          <dd className="ntf-fact__value">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {record?.quotes.map((quote) => (
                    <blockquote key={quote.label} className={`ntf-quote${quote.negative ? ' is-negative' : ''}`}>
                      <p className="ntf-quote__label">{quote.label}</p>
                      <p className="ntf-quote__text">&ldquo;{quote.text}&rdquo;</p>
                    </blockquote>
                  ))}

                  <footer className="ntf-record__foot">
                    {selected.link ? (
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary ui-btn--sm"
                        onClick={() => handleAction(selected)}
                      >
                        {selected.actionText || 'Open'}
                        <Mark name="arrow" size={14} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ui-btn ui-btn--quiet ui-btn--sm"
                      onClick={() =>
                        selected.isRead ? markUnread(selected._id) : markRead(selected._id)
                      }
                    >
                      <Mark name={selected.isRead ? 'arrowLeft' : 'check'} size={14} />
                      {selected.isRead ? 'Mark as unread' : 'Mark as read'}
                    </button>
                  </footer>
                </article>
              </aside>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
