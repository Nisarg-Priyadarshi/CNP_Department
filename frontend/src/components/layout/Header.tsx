import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useChrome } from '../ui/ChromeContext';
import { Tooltip } from '../ui/Tooltip';
import { MOD_LABEL, isEditableTarget } from '../ui/useHotkeys';
import { NAV_GROUPS, NAVIGATION, NavIcon, roleLabel } from './Sidebar';

interface NotificationRow {
  _id: string;
  title: string;
  message?: string;
  link?: string;
  isRead?: boolean;
  createdAt?: string;
}

type Popover = 'notifications' | 'account' | 'jump';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  clubs: 'Clubs',
  projects: 'Projects',
  events: 'Events',
  notifications: 'Notifications',
  inventory: 'Inventory',
  'material-requests': 'Material requests',
  profile: 'Profile',
};

const DETAIL_TITLES: Record<string, string> = {
  clubs: 'Club details',
  projects: 'Project details',
};

/** Title and optional parent crumb, both derived from the route itself. */
function routeInfo(pathname: string): { title: string; crumb?: { label: string; to: string } } {
  const segments = pathname.split('/').filter(Boolean);
  const root = segments[0] ?? 'dashboard';
  const isDetail = segments.length > 1;

  if (isDetail) {
    // MOCK: the route carries only an id, so the crumb names the collection, not the record.
    return {
      title: DETAIL_TITLES[root] ?? PAGE_TITLES[root] ?? 'Details',
      crumb: { label: PAGE_TITLES[root] ?? root, to: `/${root}` },
    };
  }

  const title = PAGE_TITLES[root] ?? root.charAt(0).toUpperCase() + root.slice(1).replace(/-/g, ' ');
  return { title };
}

function groupOf(id: string): string {
  return NAV_GROUPS.find((group) => group.items.includes(id))?.label ?? '';
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface HeaderProps {
  drawerOpen: boolean;
  onToggleMenu: () => void;
}

export function Header({ drawerOpen, onToggleMenu }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { openPalette, openShortcuts, paletteOpen, shortcutsOpen } = useChrome();
  const overlaysOpen = paletteOpen || shortcutsOpen;

  const [open, setOpen] = useState<Popover | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [notifsError, setNotifsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const bellRef = useRef<HTMLButtonElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifFootRef = useRef<HTMLAnchorElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const jumpButtonRef = useRef<HTMLButtonElement>(null);
  const jumpRef = useRef<HTMLDivElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const { title, crumb } = routeInfo(location.pathname);

  /* Any navigation dismisses whatever was open. */
  useEffect(() => {
    setOpen(null);
  }, [location.pathname]);

  /* ── Unread count: refreshed on every route change, as before ─────────────── */
  useEffect(() => {
    if (!user) return;
    api<{ count?: number }>('GET', '/notifications/unread-count')
      .then((res) => setUnreadCount(res.count ?? 0))
      .catch(() => {});
  }, [user, location.pathname]);

  /* ── One overlay at a time: Escape closes, outside press dismisses ────────── */
  useEffect(() => {
    if (!open) return;

    const panel =
      open === 'notifications' ? notifRef.current
        : open === 'account' ? accountRef.current
          : jumpRef.current;
    const trigger =
      open === 'notifications' ? bellRef.current
        : open === 'account' ? userButtonRef.current
          : jumpButtonRef.current;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel?.contains(target) || trigger?.contains(target)) return;
      setOpen(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(null);
      trigger?.focus();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /* ── "/" focuses the jump box, unless the person is already typing ────────── */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (overlaysOpen) return;
      if (isEditableTarget(event.target)) return;
      if (document.querySelector('.ui-overlay')) return;
      event.preventDefault();
      setOpen('jump');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [overlaysOpen]);

  /* The palette's "Jump to a page" action lands here. */
  useEffect(() => {
    const openJump = () => setOpen('jump');
    window.addEventListener('cnp:jump', openJump);
    return () => window.removeEventListener('cnp:jump', openJump);
  }, []);

  useEffect(() => {
    if (open !== 'jump') return;
    setQuery('');
    const frame = window.requestAnimationFrame(() => jumpInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  /* ── Notifications ───────────────────────────────────────────────────────── */
  const toggleNotifications = () => {
    if (open === 'notifications') {
      setOpen(null);
      return;
    }
    setOpen('notifications');
    setNotifsLoading(true);
    setNotifsError(null);
    api<{ data?: NotificationRow[] }>('GET', '/notifications?limit=5')
      .then((res) => setNotifs(res.data ?? []))
      .catch(() => setNotifsError('Could not load notifications.'))
      .finally(() => setNotifsLoading(false));
  };

  const handleNotificationClick = async (notif: NotificationRow) => {
    setOpen(null);
    if (!notif.isRead) {
      try {
        await api('PATCH', `/notifications/${notif._id}/read`);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifs((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
      } catch {
        /* leave the row unread; the inbox stays the source of truth */
      }
    }
    if (notif.link) {
      navigate(notif.link);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api('PATCH', '/notifications/read-all');
      setUnreadCount(0);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      // The control that had focus disappears with the last unread row.
      window.requestAnimationFrame(() => notifFootRef.current?.focus());
    } catch {
      setNotifsError('Could not mark notifications read.');
    }
  };

  /* ── Account ─────────────────────────────────────────────────────────────── */
  const handleSignOut = () => {
    setOpen(null);
    navigate('/', { replace: true });
    logout();
  };

  /* ── Jump to (client-side filter over the signed-in destinations) ──────────
   * MOCK: no search endpoint exists, so this filters the nav list in the browser.
   * See docs/mocks/shell.md. */
  const destinations = user ? NAVIGATION.filter((item) => item.roles.includes(user.role)) : [];
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? destinations.filter(
        (item) => item.label.toLowerCase().includes(needle) || item.path.slice(1).includes(needle),
      )
    : destinations;

  const go = (path: string) => {
    setOpen(null);
    navigate(path);
  };

  return (
    <header className="shell-header">
      <div className="shell-header__inner">
        <div className="hdr-lead">
          <button
            type="button"
            className="ui-icon-btn hdr-menu-toggle"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="shell-rail"
            onClick={onToggleMenu}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>

          <div className="hdr-titles">
            <div className="hdr-title" id="shell-page-title">
              {crumb && (
                <nav className="hdr-crumbs" aria-label="Breadcrumb">
                  <ol>
                    <li><Link to={crumb.to}>{crumb.label}</Link></li>
                  </ol>
                </nav>
              )}
              <span className="hdr-title__current">{title}</span>
            </div>
          </div>
        </div>

        <div className="hdr-actions">
          <div className="hdr-slot">
            <Tooltip label="Search and commands">
              <button
                ref={jumpButtonRef}
                type="button"
                className="hdr-search"
                aria-label={`Search and commands (${MOD_LABEL}K)`}
                aria-haspopup="dialog"
                aria-expanded={paletteOpen}
                onClick={() => {
                  setOpen(null);
                  openPalette();
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
                  <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <span className="hdr-search__label">Search</span>
                <span className="hdr-search__kbd" aria-hidden="true">
                  <kbd className="ui-kbd">{MOD_LABEL}</kbd>
                  <kbd className="ui-kbd">K</kbd>
                </span>
              </button>
            </Tooltip>

            {open === 'jump' && (
              <div id="hdr-jump" ref={jumpRef} className="ui-menu hdr-jump" role="dialog" aria-label="Jump to a page">
                <div className="hdr-jump__head">
                  <span>Jump to a page</span>
                  <span className="hdr-jump__hint">
                    <kbd className="ui-kbd">/</kbd>
                  </span>
                </div>
                <div className="ui-search hdr-jump__field">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
                    <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={jumpInputRef}
                    className="ui-field"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && matches[0]) {
                        event.preventDefault();
                        go(matches[0].path);
                      }
                    }}
                    placeholder="Search pages"
                    aria-label="Search pages"
                  />
                </div>

                {matches.length > 0 ? (
                  <ul className="hdr-jump__list">
                    {matches.map((item) => (
                      <li key={item.id}>
                        <Link className="ui-menu__item hdr-jump__item" to={item.path} onClick={() => setOpen(null)}>
                          <NavIcon id={item.id} className="hdr-icon" />
                          <span className="ui-grow ui-truncate">{item.label}</span>
                          <span className="hdr-jump__group">{groupOf(item.id)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hdr-jump__empty">No page matches “{query}”.</p>
                )}

                <button
                  type="button"
                  className="hdr-jump__more"
                  onClick={() => {
                    setOpen(null);
                    openPalette();
                  }}
                >
                  <span>Search everything</span>
                  <span className="hdr-jump__hint" aria-hidden="true">
                    <kbd className="ui-kbd">{MOD_LABEL}</kbd>
                    <kbd className="ui-kbd">K</kbd>
                  </span>
                </button>
              </div>
            )}
          </div>

          {user && (
            <Tooltip label="Keyboard shortcuts">
              <button
                type="button"
                className="ui-icon-btn hdr-keys"
                aria-label="Keyboard shortcuts"
                aria-expanded={shortcutsOpen}
                onClick={() => {
                  setOpen(null);
                  openShortcuts();
                }}
              >
                <span className="hdr-keys__cap" aria-hidden="true">?</span>
              </button>
            </Tooltip>
          )}

          {user && <span className="ui-tag ui-tag--plain hdr-role">{roleLabel(user.role)}</span>}

          <div className="hdr-slot">
            <Tooltip
              label={
                unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'Notifications'
              }
            >
              <button
                ref={bellRef}
                type="button"
                className="ui-icon-btn hdr-bell"
                onClick={toggleNotifications}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={open === 'notifications'}
                aria-controls={open === 'notifications' ? 'hdr-notif' : undefined}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                  <path
                    d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="hdr-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            </Tooltip>

            {open === 'notifications' && (
              <div id="hdr-notif" ref={notifRef} className="ui-menu hdr-notif" role="dialog" aria-label="Notifications">
                <div className="hdr-notif__head">
                  <span className="hdr-notif__title">
                    Notifications
                    {unreadCount > 0 && <span className="ui-count ui-count--accent">{unreadCount}</span>}
                  </span>
                  {unreadCount > 0 && (
                    <button type="button" className="hdr-notif__markall" onClick={handleMarkAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>

                {notifsError && <p className="hdr-notif__error">{notifsError}</p>}

                <div className="hdr-notif__list">
                  {notifsLoading ? (
                    <>
                      {[0, 1, 2].map((i) => (
                        <div className="hdr-notif__skeleton" key={i} aria-hidden="true">
                          <span className="ui-skel hdr-notif__skel-dot" />
                          <span className="hdr-notif__skel-lines">
                            <span className="ui-skel hdr-notif__skel-title" />
                            <span className="ui-skel hdr-notif__skel-line" />
                          </span>
                        </div>
                      ))}
                    </>
                  ) : notifs.length > 0 ? (
                    notifs.map((notif) => {
                      const unread = !notif.isRead;
                      return (
                        <button
                          key={notif._id}
                          type="button"
                          className={`hdr-notif__row${unread ? ' is-unread' : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                          aria-label={unread ? `Unread: ${notif.title}` : notif.title}
                        >
                          <span className="hdr-notif__flag" aria-hidden="true" />
                          <span className="hdr-notif__body">
                            <span className="hdr-notif__row-title">{notif.title}</span>
                            {notif.message && <span className="hdr-notif__message">{notif.message}</span>}
                          </span>
                          <span className="hdr-notif__time">{formatTimeAgo(notif.createdAt)}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="hdr-notif__empty">
                      Nothing new. Club, project and request updates land here.
                    </p>
                  )}
                </div>

                <Link
                  ref={notifFootRef}
                  className="hdr-notif__foot"
                  to="/notifications"
                  onClick={() => setOpen(null)}
                >
                  View all notifications
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                    <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            )}
          </div>

          {user && (
            <div className="hdr-slot">
              <button
                ref={userButtonRef}
                type="button"
                className="hdr-user"
                aria-label={`Account menu, ${user.name}`}
                onClick={() => (open === 'account' ? setOpen(null) : setOpen('account'))}
                aria-expanded={open === 'account'}
                aria-controls={open === 'account' ? 'hdr-account' : undefined}
              >
                {user.profileImage ? (
                  <span className="hdr-avatar">
                    <img src={user.profileImage} alt="" decoding="async" />
                  </span>
                ) : (
                  <span className="hdr-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
                )}
                <span className="hdr-user__name">{user.name}</span>
                <svg className="hdr-user__chev" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {open === 'account' && (
                <div id="hdr-account" ref={accountRef} className="ui-menu hdr-menu" aria-label="Account">
                  <div className="hdr-menu__head">
                    <span className="hdr-menu__name">{user.name}</span>
                    <span className="hdr-menu__role">{roleLabel(user.role)}</span>
                  </div>
                  <div className="hdr-menu__items">
                    <Link className="ui-menu__item" to="/profile" onClick={() => setOpen(null)}>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path
                          d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Profile
                    </Link>
                    <button
                      type="button"
                      className="ui-menu__item"
                      onClick={() => {
                        setOpen(null);
                        openShortcuts();
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path
                          d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Keyboard shortcuts
                      <span className="ui-kbd hdr-menu__kbd" aria-hidden="true">?</span>
                    </button>
                    <button type="button" className="ui-menu__item" onClick={handleSignOut}>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path
                          d="M15 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8M14 12h7m-3-3 3 3-3 3"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
