import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { usePageLoading } from '../../context/LoadingContext';
import { Counter } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import { OpsOverlay } from '../Inventory/OpsOverlay';
import '../Inventory/ops.css';

interface RequestUser {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  semester?: number | null;
}

interface MaterialRequest {
  _id: string;
  materialName?: string;
  specifications?: string;
  quantity: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: RequestUser | null;
  createdAt?: string;
  updatedAt?: string;
  imageUrl?: string | null;
  documentUrl?: string | null;
  documentOriginalName?: string | null;
  projectId?: { _id?: string; name?: string; status?: string } | null;
  requestedBy?: RequestUser | null;
  inventoryItemId?: {
    _id?: string;
    name?: string;
    category?: string;
    availableQuantity?: number;
    totalQuantity?: number;
    location?: string;
  } | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_LABEL: Record<MaterialRequest['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const itemNameOf = (request: MaterialRequest) =>
  request.materialName || request.inventoryItemId?.name || 'Unlisted item';

const formatDay = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    : 'Unknown';

const formatStamp = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

const initialsOf = (name?: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const waitMs = (value?: string) => (value ? Math.max(0, Date.now() - new Date(value).getTime()) : 0);

const waitingLabel = (value?: string) => {
  if (!value) return 'None';
  const elapsed = waitMs(value);
  if (elapsed < 60 * 60 * 1000) return `${Math.max(1, Math.round(elapsed / (60 * 1000)))}m`;
  if (elapsed < 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / (60 * 60 * 1000))}h`;
  return `${Math.floor(elapsed / (24 * 60 * 60 * 1000))}d`;
};

const rise = (index: number): CSSProperties => ({ '--i': Math.min(index, 7) } as CSSProperties);

const isPending = (request: MaterialRequest) => request.status === 'pending';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 11a8 8 0 1 0-2.3 6.3" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
      <path d="M5 5h14l1 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5l1-8Z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
      <path d="M14 3v4h4M9 12h6M9 16h4" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   The two marks this area repeats: requested against stock, and a status square.
   ───────────────────────────────────────────────────────────────────────────── */

interface StockBarProps {
  requested: number;
  available?: number | null;
  size?: 'sm' | 'md';
}

/**
 * Requested quantity measured against the stock on hand. The fill is the request;
 * the vertical mark is what the shelf holds. A request past the mark is short.
 * With no stock number the bar draws the bare request and says so.
 */
function StockBar({ requested, available, size = 'sm' }: StockBarProps) {
  const known = typeof available === 'number' && Number.isFinite(available);
  const stock = known ? (available as number) : 0;
  const ceiling = Math.max(requested, stock, 1);
  const requestFrac = Math.max(0, Math.min(requested / ceiling, 1));
  const stockFrac = known ? Math.max(0, Math.min(stock / ceiling, 1)) : 1;
  const short = known && requested > stock;

  return (
    <span
      className={`ops-stockbar ops-stockbar--${size}${short ? ' is-short' : ''}`}
      role="img"
      aria-label={
        known
          ? `${requested} requested, ${stock} in stock${short ? ', short by ' + (requested - stock) : ''}`
          : `${requested} requested, stock not listed`
      }
    >
      <span className="ops-stockbar__track" aria-hidden="true">
        <span className="ops-stockbar__fill" style={{ '--w': requestFrac } as CSSProperties} />
        {known && <span className="ops-stockbar__stock" style={{ '--x': stockFrac } as CSSProperties} />}
      </span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pipeline — pending → approved → rejected, proportional widths, plus the age
   of everything still waiting on one rail.
   ───────────────────────────────────────────────────────────────────────────── */

interface StageProps {
  stage: Exclude<StatusFilter, 'all'>;
  count: number;
  total: number;
  index: number;
  pressed: boolean;
  onToggle: () => void;
}

function Stage({ stage, count, total, index, pressed, onToggle }: StageProps) {
  const share = total > 0 ? count / total : 0;
  return (
    <button
      type="button"
      className="ops-stage"
      data-status={stage}
      aria-pressed={pressed}
      onClick={onToggle}
      style={{ '--w': share, '--i': index } as CSSProperties}
    >
      <span className={`ops-stage__mark ops-mark--${stage}`} aria-hidden="true" />
      <span className="ops-stage__label">{STATUS_LABEL[stage]}</span>
      <span className="ops-stage__track" aria-hidden="true">
        <span className="ops-stage__fill" />
      </span>
      <span className="ops-stage__n">
        <Counter value={count} />
      </span>
    </button>
  );
}

function AgeRail({ requests }: { requests: MaterialRequest[] }) {
  const oldest = requests.reduce((max, request) => Math.max(max, waitMs(request.createdAt)), 0);
  const span = Math.max(oldest, 1);
  const oldestRequest = requests.reduce<MaterialRequest | null>(
    (found, request) => (!found || waitMs(request.createdAt) > waitMs(found.createdAt) ? request : found),
    null,
  );

  return (
    <div
      className="ops-age"
      role="img"
      aria-label={`${requests.length} waiting, oldest ${waitingLabel(oldestRequest?.createdAt)}`}
    >
      <span className="ops-age__label">Waiting</span>
      <div className="ops-age__rail">
        {requests.map((request) => {
          const fraction = waitMs(request.createdAt) / span;
          const isOldest = request === oldestRequest;
          return (
            <span
              className={`ops-age__tick${isOldest ? ' is-oldest' : ''}`}
              key={request._id}
              style={{ left: `${fraction * 100}%` }}
              title={`${request.requestedBy?.name || 'Unknown requester'} · ${waitingLabel(request.createdAt)}`}
            />
          );
        })}
      </div>
      <div className="ops-age__axis" aria-hidden="true">
        <span>now</span>
        <span>{waitingLabel(oldestRequest?.createdAt)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   One ticket in the review queue.
   ───────────────────────────────────────────────────────────────────────────── */

interface TicketProps {
  request: MaterialRequest;
  ageFraction: number;
  onOpen: (request: MaterialRequest) => void;
  onApprove: (request: MaterialRequest) => void;
  onReject: (request: MaterialRequest) => void;
  busy: boolean;
}

function Ticket({ request, ageFraction, onOpen, onApprove, onReject, busy }: TicketProps) {
  const item = itemNameOf(request);
  const project = request.projectId?.name || 'Unknown project';
  const requester = request.requestedBy;
  const available = request.inventoryItemId?.availableQuantity;
  const note = request.reason?.trim() || request.specifications?.trim() || '';

  return (
    <li className="ops-ticket" style={{ '--age': ageFraction } as CSSProperties}>
      <button
        type="button"
        className="ops-ticket__open"
        aria-label={`Open request for ${request.quantity} of ${item} from ${requester?.name || 'unknown requester'}, waiting ${waitingLabel(request.createdAt)}`}
        onClick={() => onOpen(request)}
      />
      <span className="ops-ticket__wait" title={`Waiting ${waitingLabel(request.createdAt)}`}>
        {waitingLabel(request.createdAt)}
      </span>

      <span
        className="ui-avatar ui-avatar--sm ops-ticket__who"
        title={[requester?.name, requester?.email, requester?.department, requester?.semester ? `Sem ${requester.semester}` : null]
          .filter(Boolean)
          .join(' · ')}
        aria-hidden="true"
      >
        {initialsOf(requester?.name)}
      </span>

      <div className="ops-ticket__main">
        <p className="ops-ticket__item" title={note || item}>{item}</p>
        <p className="ops-ticket__project">{project}</p>
      </div>

      <div className="ops-ticket__stock">
        <StockBar requested={request.quantity} available={available} />
        <span className="ops-ticket__nums">
          <strong>{request.quantity}</strong>
          <span className="ops-ticket__slash">/</span>
          {available ?? '—'}
        </span>
      </div>

      <div className="ops-ticket__actions">
        <button
          type="button"
          className="ui-btn ui-btn--quiet ui-btn--sm"
          onClick={() => onReject(request)}
          disabled={busy}
        >
          Reject
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--primary ui-btn--sm"
          onClick={() => onApprove(request)}
          disabled={busy}
        >
          {busy ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </li>
  );
}

export default function MaterialRequests() {
  const { setPageLoading } = usePageLoading();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showResolved, setShowResolved] = useState(false);

  const [detail, setDetail] = useState<MaterialRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<MaterialRequest | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MaterialRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const focusReturn = useRef<HTMLElement | null>(null);

  const loadRequests = async () => {
    try {
      setPageLoading(true);
      setLoadError(null);
      const res = await api<any>('GET', '/material-requests');
      setRequests(res.data || []);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load material requests');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const rememberFocus = () => {
    focusReturn.current = document.activeElement as HTMLElement | null;
  };
  const restoreFocus = () => {
    window.requestAnimationFrame(() => focusReturn.current?.focus());
  };

  const openDetail = (request: MaterialRequest) => {
    rememberFocus();
    setDetail(request);
  };

  const closeDetail = () => {
    setDetail(null);
    restoreFocus();
  };

  const openApprove = (request: MaterialRequest) => {
    rememberFocus();
    setApproveTarget(request);
    setApproveError(null);
  };

  const closeApprove = () => {
    setApproveTarget(null);
    setApproveError(null);
    restoreFocus();
  };

  const openReject = (request: MaterialRequest) => {
    rememberFocus();
    setRejectTarget(request);
    setRejectReason('');
    setRejectError(null);
  };

  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason('');
    setRejectError(null);
    restoreFocus();
  };

  const handleApprove = async (req: MaterialRequest): Promise<boolean> => {
    const itemName = req.materialName || req.inventoryItemId?.name || 'Item';

    try {
      setActionLoading(req._id);
      setAlertMsg(null);
      setApproveError(null);
      await api('PATCH', `/material-requests/${req._id}/approve`);
      setDetail(null);
      setAlertMsg({ type: 'success', message: `Successfully approved request for ${req.quantity}x "${itemName}".` });
      await loadRequests();
      return true;
    } catch (e: any) {
      const message = e.message || 'Failed to approve request';
      setApproveError(message);
      setAlertMsg({ type: 'error', message });
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget || !rejectReason.trim()) return;

    try {
      setActionLoading(rejectTarget._id);
      setAlertMsg(null);
      setRejectError(null);
      await api('PATCH', `/material-requests/${rejectTarget._id}/reject`, { rejectionReason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      setDetail(null);
      setAlertMsg({ type: 'success', message: 'Material request rejected.' });
      await loadRequests();
      restoreFocus();
    } catch (e: any) {
      const message = e.message || 'Failed to reject request';
      setRejectError(message);
      setAlertMsg({ type: 'error', message });
    } finally {
      setActionLoading(null);
    }
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    const target = approveTarget;
    const ok = await handleApprove(target);
    if (ok) {
      setApproveTarget(null);
      setApproveError(null);
      restoreFocus();
    }
  };

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter(isPending).length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    }),
    [requests],
  );

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    requests.forEach((request) => {
      if (request.projectId?._id && request.projectId.name) {
        seen.set(request.projectId._id, request.projectId.name);
      }
    });
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests]);

  const visible = useMemo(() => {
    // MOCK: status, project and text filters run client-side; GET /material-requests returns every request.
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (projectFilter !== 'all' && request.projectId?._id !== projectFilter) return false;
      if (!needle) return true;
      return [
        itemNameOf(request),
        request.projectId?.name,
        request.requestedBy?.name,
        request.requestedBy?.email,
        request.reason,
        request.specifications,
        request.rejectionReason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [requests, query, projectFilter]);

  const pendingRequests = useMemo(
    () =>
      visible
        .filter(isPending)
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [visible],
  );

  const pendingAll = useMemo(
    () =>
      requests
        .filter(isPending)
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [requests],
  );

  const oldestWait = useMemo(
    () => pendingAll.reduce((max, request) => Math.max(max, waitMs(request.createdAt)), 0),
    [pendingAll],
  );

  const resolvedRequests = useMemo(
    () =>
      visible
        .filter((request) => !isPending(request))
        .sort((a, b) => new Date(b.reviewedAt || b.createdAt || 0).getTime() - new Date(a.reviewedAt || a.createdAt || 0).getTime()),
    [visible],
  );

  const resolvedForFilter = useMemo(() => {
    if (filter === 'approved') return resolvedRequests.filter((r) => r.status === 'approved');
    if (filter === 'rejected') return resolvedRequests.filter((r) => r.status === 'rejected');
    return resolvedRequests;
  }, [resolvedRequests, filter]);

  const showPending = filter === 'all' || filter === 'pending';
  const showResolvedSection = filter === 'all' || filter === 'approved' || filter === 'rejected';
  const isCollapsible = filter === 'all';
  const renderResolvedSection =
    filter === 'approved' || filter === 'rejected' || resolvedRequests.length > 0;

  const filterLabel =
    filter === 'approved' ? 'Approved' : filter === 'rejected' ? 'Rejected' : 'Resolved';

  const hasSearch = query.trim().length > 0 || projectFilter !== 'all';

  const resetFilters = () => {
    setQuery('');
    setProjectFilter('all');
  };

  const toggleStage = (stage: Exclude<StatusFilter, 'all'>) => {
    setFilter((current) => (current === stage ? 'all' : stage));
    setShowResolved(false);
  };

  useEffect(() => {
    const overlayOpen = !!detail || !!approveTarget || !!rejectTarget;
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (rejectTarget) closeReject();
      else if (approveTarget) closeApprove();
      else closeDetail();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [detail, approveTarget, rejectTarget]);

  const approveStock = approveTarget?.inventoryItemId?.availableQuantity ?? 0;
  const approveShort = !!approveTarget && approveTarget.quantity > approveStock;
  const detailStock = detail?.inventoryItemId?.availableQuantity;
  const detailShort = detail != null && detailStock != null && detail.quantity > detailStock;

  return (
    <div className="ops-page">
      <header className="ui-page-head ops-rise" style={rise(0)}>
        <div className="ui-page-head__text">
          <h1 className="ui-title">Material requests</h1>
        </div>
        <div className="ui-page-actions ops-head-tools">
          <div className="ui-search ops-search">
            <SearchIcon />
            <label className="ui-visually-hidden" htmlFor="ops-request-search">Search requests</label>
            <input
              id="ops-request-search"
              className="ui-field"
              type="search"
              placeholder="Search requests"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
          </div>
          {projects.length > 1 && (
            <div className="ops-select ops-filter">
              <label className="ui-visually-hidden" htmlFor="ops-request-project">Filter by project</label>
              <select
                id="ops-request-project"
                className="ui-field ui-field--select"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                disabled={loading}
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <ChevronDownIcon />
            </div>
          )}
        </div>
      </header>

      <div className="ops-body">
        {alertMsg && (
          <div
            className={`ui-notice ${alertMsg.type === 'success' ? 'ops-notice--success' : 'ui-notice--error'}`}
            role="status"
          >
            <div className="ui-grow">{alertMsg.message}</div>
            <button
              type="button"
              className="ui-icon-btn"
              aria-label="Dismiss message"
              onClick={() => setAlertMsg(null)}
            >
              <CloseIcon />
            </button>
          </div>
        )}

        {loadError && (
          <div className="ui-notice ui-notice--error" role="alert">
            <div className="ui-grow">
              <p>Material requests could not be loaded.</p>
              <p className="ops-note">{loadError}</p>
            </div>
            <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={loadRequests}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="ops-stack" aria-busy="true">
            <div className="ops-console ops-console--skel" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <div className="ops-console__cell" key={n}>
                  <div className="ui-skel ops-skel-line ops-skel-line--sm" />
                  <div className="ui-skel ops-skel-line ops-skel-line--value" />
                  <div className="ui-skel ops-skel-line ops-skel-line--rail" />
                </div>
              ))}
            </div>
            <div className="ui-panel" aria-hidden="true">
              <header className="ui-panel__head">
                <div className="ui-skel ops-skel-line ops-skel-line--head" />
              </header>
              <div className="ops-skel-rows">
                {[0, 1, 2].map((n) => (
                  <div className="ops-skel-row" key={n}>
                    <div>
                      <div className="ui-skel ops-skel-line" />
                      <div className="ui-skel ops-skel-line ops-skel-line--sm" />
                    </div>
                    <div className="ui-skel ops-skel-line ops-skel-line--wide" />
                    <div className="ui-skel ops-skel-line" />
                  </div>
                ))}
              </div>
            </div>
            <span className="ui-visually-hidden" role="status">Loading material requests</span>
          </div>
        ) : requests.length === 0 && !loadError ? (
          <div className="ui-empty">
            <span className="ui-empty__mark"><InboxIcon /></span>
            <p className="ui-empty__title">No material requests</p>
            <p className="ui-empty__text">Requests arrive here when a team leader draws from the store room.</p>
            <Link className="ui-btn ui-btn--quiet ui-btn--sm" to="/inventory">
              Open inventory
            </Link>
          </div>
        ) : requests.length > 0 ? (
          <>
            <section className="ui-panel ui-panel--accent ops-rise" style={rise(1)} aria-labelledby="ops-pipeline-title">
              <header className="ui-panel__head">
                <div className="ui-panel__titles">
                  <h2 className="ui-panel__title" id="ops-pipeline-title">Pipeline</h2>
                  <span className="ui-panel__meta">{counts.all}</span>
                </div>
                <div className="ops-panel-tools">
                  {filter !== 'all' && (
                    <button
                      type="button"
                      className="ui-btn ui-btn--quiet ui-btn--sm"
                      onClick={() => {
                        setFilter('all');
                        setShowResolved(false);
                      }}
                    >
                      All
                    </button>
                  )}
                  <button
                    type="button"
                    className="ui-icon-btn"
                    aria-label="Refresh requests"
                    title="Refresh"
                    onClick={refresh}
                    disabled={refreshing}
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </header>

              <div className="ops-panel-body">
                <div className="ops-funnel">
                  {(['pending', 'approved', 'rejected'] as const).map((stage, index) => (
                    <Stage
                      key={stage}
                      stage={stage}
                      count={counts[stage]}
                      total={counts.all}
                      index={index}
                      pressed={filter === stage}
                      onToggle={() => toggleStage(stage)}
                    />
                  ))}
                </div>

                {pendingAll.length > 0 && <AgeRail requests={pendingAll} />}
              </div>
            </section>

            {showPending && (
              <section className="ops-region ops-rise" style={rise(2)} aria-labelledby="ops-review-title">
                <header className="ops-region__head">
                  <div className="ops-region__titles">
                    <h2 className="ops-region__title" id="ops-review-title">Needs review</h2>
                    <span className="ops-region__n">{pendingRequests.length}</span>
                  </div>
                  <div className="ops-region__tools">
                    {hasSearch && (
                      <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={resetFilters}>
                        Clear filters
                      </button>
                    )}
                  </div>
                </header>

                {pendingRequests.length > 0 ? (
                  <ul className="ops-tickets">
                    {pendingRequests.map((request) => (
                      <Ticket
                        key={request._id}
                        request={request}
                        ageFraction={oldestWait > 0 ? waitMs(request.createdAt) / oldestWait : 0}
                        onOpen={openDetail}
                        onApprove={openApprove}
                        onReject={openReject}
                        busy={actionLoading === request._id}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="ops-empty-wrap">
                    <div className="ui-empty ui-empty--tight">
                      <span className="ui-empty__mark"><InboxIcon /></span>
                      <p className="ui-empty__title">Nothing waiting</p>
                      <p className="ui-empty__text">
                        {counts.pending > 0 && hasSearch
                          ? 'No pending request matches the current filter.'
                          : 'Every request has been reviewed.'}
                      </p>
                      {counts.pending > 0 && hasSearch ? (
                        <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={resetFilters}>
                          Clear filters
                        </button>
                      ) : resolvedRequests.length > 0 ? (
                        <button
                          type="button"
                          className="ui-btn ui-btn--quiet ui-btn--sm"
                          onClick={() => setShowResolved(true)}
                        >
                          Review resolved
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            )}

            {showResolvedSection && renderResolvedSection && (
              <section className="ui-panel ops-rise" style={rise(3)} aria-labelledby="ops-resolved-title">
                {isCollapsible ? (
                  <button
                    type="button"
                    className="ops-disclosure"
                    aria-expanded={showResolved}
                    aria-controls="ops-resolved-body"
                    onClick={() => setShowResolved((open) => !open)}
                  >
                    <span className="ops-disclosure__title" id="ops-resolved-title">{filterLabel}</span>
                    <span className="ops-disclosure__n">{resolvedRequests.length}</span>
                    <span className="ops-disclosure__mark"><ChevronIcon /></span>
                  </button>
                ) : (
                  <header className="ui-panel__head">
                    <div className="ui-panel__titles">
                      <h2 className="ui-panel__title" id="ops-resolved-title">{filterLabel}</h2>
                      <span className="ui-panel__meta">{resolvedForFilter.length}</span>
                    </div>
                    <div className="ops-panel-tools">
                      <button
                        type="button"
                        className="ui-icon-btn"
                        aria-label="Refresh requests"
                        title="Refresh"
                        onClick={refresh}
                        disabled={refreshing}
                      >
                        <RefreshIcon />
                      </button>
                    </div>
                  </header>
                )}

                {(!isCollapsible || showResolved) && (
                  <div id="ops-resolved-body">
                    {resolvedForFilter.length > 0 ? (
                      <ul className="ui-rows ops-resolved">
                        {resolvedForFilter.map((request) => {
                          return (
                            <li className="ui-row ops-resolved__row" key={request._id}>
                              <button
                                type="button"
                                className="ops-row-open"
                                aria-label={`Open ${request.status} request for ${request.quantity} of ${itemNameOf(request)}`}
                                onClick={() => openDetail(request)}
                              />
                              <span className={`ops-mark ops-mark--${request.status}`} aria-hidden="true" />
                              <div className="ui-row__main">
                                <p className="ui-row__title">
                                  {request.quantity} × {itemNameOf(request)}
                                </p>
                                <p className="ui-row__sub">
                                  {request.projectId?.name || 'Unknown project'}
                                  {request.requestedBy?.name ? ` · ${request.requestedBy.name}` : ''}
                                </p>
                              </div>
                              <div className="ui-row__meta">
                                <span className="ops-resolved__state">{STATUS_LABEL[request.status]}</span>
                                <span className="ops-resolved__when">{formatDay(request.reviewedAt || request.createdAt)}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="ops-empty-wrap">
                        <div className="ui-empty ui-empty--tight">
                          <span className="ui-empty__mark"><InboxIcon /></span>
                          <p className="ui-empty__title">
                            No {filter === 'approved' ? 'approved' : 'rejected'} requests
                          </p>
                          {(filter === 'approved' ? counts.approved : counts.rejected) > 0 && hasSearch ? (
                            <>
                              <p className="ui-empty__text">None matches the current filter.</p>
                              <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={resetFilters}>
                                Clear filters
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        ) : null}
      </div>

      {detail && (
        <OpsOverlay className="ops-overlay--drawer" onClose={closeDetail}>
          <aside
            className="ops-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-request-title"
          >
            <header className="ui-modal__head">
              <div className="ui-grow">
                <div className="ops-detail__head">
                  <span className={`ops-mark ops-mark--${detail.status}`} aria-hidden="true" />
                  <span className="ops-detail__state">{STATUS_LABEL[detail.status]}</span>
                  <span className="ops-detail__stamp">{formatStamp(detail.createdAt)}</span>
                </div>
                <h2 className="ops-drawer__title" id="ops-request-title">
                  {detail.quantity} × {itemNameOf(detail)}
                </h2>
                <p className="ops-drawer__project">{detail.projectId?.name || 'Unknown project'}</p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close request" onClick={closeDetail} autoFocus>
                <CloseIcon />
              </button>
            </header>

            <div className="ops-drawer__body">
              <section className="ops-drawer__stock" aria-label="Stock">
                <StockBar requested={detail.quantity} available={detail.inventoryItemId?.availableQuantity} size="md" />
                <dl className="ops-stocknums">
                  <div>
                    <dt>Requested</dt>
                    <dd>{detail.quantity}</dd>
                  </div>
                  <div>
                    <dt>In stock</dt>
                    <dd>{detail.inventoryItemId?.availableQuantity ?? '—'}</dd>
                  </div>
                  {detail.status === 'pending' && detailStock != null ? (
                    <div>
                      <Tooltip label="Deducted from the shelf once, on approval">
                        <dt className="ops-stocknums__hint" tabIndex={0}>Left after</dt>
                      </Tooltip>
                      <dd className={detailShort ? 'is-short' : undefined}>
                        {Math.max(0, detailStock - detail.quantity)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <dl className="ops-facts">
                <div className="ops-fact">
                  <dt className="ops-fact__label">Requested by</dt>
                  <dd className="ops-fact__value ops-fact__person">
                    <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                      {initialsOf(detail.requestedBy?.name)}
                    </span>
                    <span
                      title={[detail.requestedBy?.email, detail.requestedBy?.department, detail.requestedBy?.semester ? `Sem ${detail.requestedBy.semester}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {detail.requestedBy?.name || 'Unknown requester'}
                    </span>
                  </dd>
                </div>
                <div className="ops-fact">
                  <dt className="ops-fact__label">Project</dt>
                  <dd className="ops-fact__value">{detail.projectId?.name || 'Unknown project'}</dd>
                </div>
                <div className="ops-fact">
                  <dt className="ops-fact__label">Category</dt>
                  <dd className="ops-fact__value">{detail.inventoryItemId?.category || '—'}</dd>
                </div>
                <div className="ops-fact">
                  <dt className="ops-fact__label">Location</dt>
                  <dd className="ops-fact__value">{detail.inventoryItemId?.location || '—'}</dd>
                </div>
              </dl>

              {detail.reason?.trim() ? (
                <section aria-labelledby="ops-detail-reason">
                  <h3 className="ops-section-label" id="ops-detail-reason">Reason</h3>
                  <p className="ops-quote">{detail.reason}</p>
                </section>
              ) : null}

              {detail.specifications?.trim() ? (
                <section aria-labelledby="ops-detail-spec">
                  <h3 className="ops-section-label" id="ops-detail-spec">Specifications</h3>
                  <p className="ops-quote">{detail.specifications}</p>
                </section>
              ) : null}

              {(detail.imageUrl || detail.documentUrl) && (
                <section aria-labelledby="ops-detail-files">
                  <h3 className="ops-section-label" id="ops-detail-files">Attachments</h3>
                  <div className="ops-attach">
                    {detail.imageUrl && (
                      <a
                        className="ops-attach__link"
                        href={detail.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img className="ops-attach__thumb" src={detail.imageUrl} alt="Component reference" />
                        <span>Component photo</span>
                      </a>
                    )}
                    {detail.documentUrl && (
                      <a
                        className="ops-attach__link"
                        href={detail.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <DocumentIcon />
                        <span>
                          {detail.documentOriginalName
                            ? detail.documentOriginalName
                            : 'Reference document'}
                        </span>
                      </a>
                    )}
                  </div>
                </section>
              )}

              {detail.status === 'rejected' && detail.rejectionReason && (
                <section aria-labelledby="ops-detail-rejection">
                  <h3 className="ops-section-label" id="ops-detail-rejection">Rejection reason</h3>
                  <p className="ops-quote ops-quote--negative">{detail.rejectionReason}</p>
                </section>
              )}

              <section aria-labelledby="ops-detail-timeline">
                <h3 className="ops-section-label" id="ops-detail-timeline">History</h3>
                <ol className="ops-steps">
                  <li className="ops-step is-done">
                    <span className="ops-step__dot" aria-hidden="true" />
                    <span className="ops-step__label">Submitted</span>
                    <span className="ops-step__when">
                      {formatStamp(detail.createdAt)}
                      {detail.requestedBy?.name ? ` · ${detail.requestedBy.name}` : ''}
                    </span>
                  </li>
                  <li
                    className={`ops-step${detail.status === 'pending' ? ' is-waiting' : ' is-done'}`}
                    data-status={detail.status}
                  >
                    <span className="ops-step__dot" aria-hidden="true" />
                    <span className="ops-step__label">
                      {detail.status === 'pending'
                        ? 'Awaiting review'
                        : detail.status === 'approved'
                          ? 'Approved'
                          : 'Rejected'}
                    </span>
                    <span className="ops-step__when">
                      {detail.status === 'pending'
                        ? 'With the project admin'
                        : `${formatStamp(detail.reviewedAt)}${detail.reviewedBy?.name ? ` · ${detail.reviewedBy.name}` : ''}`}
                    </span>
                  </li>
                </ol>
              </section>
            </div>

            <footer className="ui-modal__foot">
              {detail.status === 'pending' ? (
                <>
                  <button type="button" className="ui-btn ui-btn--quiet" onClick={() => openReject(detail)}>
                    Reject request
                  </button>
                  <button type="button" className="ui-btn ui-btn--primary" onClick={() => openApprove(detail)}>
                    Approve and allocate
                  </button>
                </>
              ) : (
                <button type="button" className="ui-btn ui-btn--ghost" onClick={closeDetail}>
                  Close
                </button>
              )}
            </footer>
          </aside>
        </OpsOverlay>
      )}

      {approveTarget && (
        <OpsOverlay onClose={closeApprove}>
          <div
            className="ui-modal ui-modal--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-approve-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id="ops-approve-title">Approve request</h2>
                <p className="ops-modal__sub">
                  {approveTarget.quantity} × {itemNameOf(approveTarget)} ·{' '}
                  {approveTarget.projectId?.name || 'Unknown project'}
                </p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close" onClick={closeApprove} autoFocus>
                <CloseIcon />
              </button>
            </header>
            <div className="ui-modal__body">
              <div className="ops-stack">
                <StockBar requested={approveTarget.quantity} available={approveTarget.inventoryItemId?.availableQuantity} size="md" />
                <dl className="ops-stocknums">
                  <div>
                    <dt>Requested</dt>
                    <dd>{approveTarget.quantity}</dd>
                  </div>
                  <div>
                    <dt>In stock</dt>
                    <dd>{approveTarget.inventoryItemId?.availableQuantity ?? '—'}</dd>
                  </div>
                  <div>
                    <Tooltip label="Deducted from the shelf once, on approval">
                      <dt className="ops-stocknums__hint" tabIndex={0}>Left after</dt>
                    </Tooltip>
                    <dd className={approveShort ? 'is-short' : undefined}>
                      {Math.max(0, approveStock - approveTarget.quantity)}
                    </dd>
                  </div>
                </dl>

                {approveShort ? (
                  <div className="ui-notice">
                    Requested quantity ({approveTarget.quantity}) exceeds currently available stock (
                    {approveStock}). Do you still wish to attempt approval?
                  </div>
                ) : null}

                <div className="ops-approve__who">
                  <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                    {initialsOf(approveTarget.requestedBy?.name)}
                  </span>
                  <span>{approveTarget.requestedBy?.name || 'Unknown requester'}</span>
                  <span className="ops-approve__stamp">{formatStamp(approveTarget.createdAt)}</span>
                </div>

                {approveError && (
                  <div className="ui-notice ui-notice--error" role="alert">{approveError}</div>
                )}
              </div>
            </div>
            <footer className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={closeApprove}>
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={confirmApprove}
                disabled={actionLoading === approveTarget._id}
              >
                {actionLoading === approveTarget._id
                  ? 'Approving…'
                  : approveShort
                    ? 'Attempt approval'
                    : 'Approve and allocate'}
              </button>
            </footer>
          </div>
        </OpsOverlay>
      )}

      {rejectTarget && (
        <OpsOverlay onClose={closeReject}>
          <div
            className="ui-modal ui-modal--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-reject-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id="ops-reject-title">Reject request</h2>
                <p className="ops-modal__sub">
                  {rejectTarget.quantity} × {itemNameOf(rejectTarget)}
                </p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close" onClick={closeReject} autoFocus>
                <CloseIcon />
              </button>
            </header>
            <form onSubmit={handleReject}>
              <div className="ui-modal__body">
                <div className="ops-form-error">
                  <label className="ui-label" htmlFor="ops-reject-reason">Reason for rejection</label>
                  <textarea
                    id="ops-reject-reason"
                    className="ui-field ui-field--area"
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="What should the team leader change or provide?"
                    required
                  />
                  <p className="ui-hint">Shown to the team leader in their project history.</p>
                </div>
                {rejectError && (
                  <div className="ui-notice ui-notice--error ops-form-error" role="alert">
                    {rejectError}
                  </div>
                )}
              </div>
              <footer className="ui-modal__foot">
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  onClick={closeReject}
                  disabled={actionLoading === rejectTarget._id}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn--danger"
                  disabled={actionLoading === rejectTarget._id || !rejectReason.trim()}
                >
                  {actionLoading === rejectTarget._id ? 'Rejecting…' : 'Confirm rejection'}
                </button>
              </footer>
            </form>
          </div>
        </OpsOverlay>
      )}
    </div>
  );
}
