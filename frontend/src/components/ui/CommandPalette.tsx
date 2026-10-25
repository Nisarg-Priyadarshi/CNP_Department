import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { NAV_GROUPS, NAV_ICON_PATHS, NAVIGATION } from '../layout/Sidebar';
import { useChrome } from './ChromeContext';
import { MOD_LABEL } from './useHotkeys';

/* ═══════════════════════════════════════════════════════════════════════════
   Command palette (⌘K / Ctrl+K)

   One field over four honest sources: the destinations this role can reach, the
   actions that exist, the clubs / projects / events the API returns, and the
   five things this person opened last. No per-keystroke network: records load
   once per session and are filtered in the browser.
   ═══════════════════════════════════════════════════════════════════════════ */

type PaletteGroup = 'Navigate' | 'Actions' | 'Records' | 'Recent';

interface PaletteItem {
  id: string;
  label: string;
  meta?: string;
  /** Shortcut glyphs, when the row has one. */
  keys?: string[];
  group: PaletteGroup;
  icon: string;
  keywords?: string;
  /** Where the row goes, so it can be remembered as recent. */
  path?: string;
  run: () => void;
}

interface PaletteRecord {
  id: string;
  kind: 'clubs' | 'projects' | 'events';
  label: string;
  meta: string;
  keywords: string;
  path: string;
}

interface RecentEntry {
  id: string;
  label: string;
  meta?: string;
  path: string;
}

// MOCK: recents live in this browser only. See docs/mocks/shell.md.
const RECENT_KEY = 'cnp_palette_recent';
const RECENT_LIMIT = 5;

/* ── Records: one fetch per session, shared by every palette open ───────────
   MOCK: the full collection payloads are filtered in the browser; there is no
   search endpoint. See docs/mocks/shell.md. */

let recordCache: PaletteRecord[] | null = null;
let recordRequest: Promise<PaletteRecord[]> | null = null;

function shortDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function statusLabel(value?: string): string {
  if (!value) return 'Project';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

async function fetchRecords(): Promise<PaletteRecord[]> {
  if (recordCache) return recordCache;
  if (recordRequest) return recordRequest;

  recordRequest = (async () => {
    const [clubs, projects, events] = await Promise.allSettled([
      api<{ data?: any[] }>('GET', '/clubs'),
      api<{ data?: any[] }>('GET', '/projects'),
      api<{ data?: any[] }>('GET', '/events'),
    ]);

    const records: PaletteRecord[] = [];

    if (clubs.status === 'fulfilled') {
      for (const club of clubs.value.data ?? []) {
        const members = club.totalMembers ?? club.memberCount;
        records.push({
          id: `club:${club._id}`,
          kind: 'clubs',
          label: club.name,
          meta: typeof members === 'number' ? `${members} members` : 'Club',
          keywords: club.facultyCoordinatorId?.name ?? '',
          path: `/clubs/${club._id}`,
        });
      }
    }

    if (projects.status === 'fulfilled') {
      for (const project of projects.value.data ?? []) {
        records.push({
          id: `project:${project._id}`,
          kind: 'projects',
          label: project.name,
          meta: statusLabel(project.status),
          keywords: project.teamLeaderId?.name ?? '',
          path: `/projects/${project._id}`,
        });
      }
    }

    if (events.status === 'fulfilled') {
      for (const event of events.value.data ?? []) {
        const when = shortDate(event.eventDate);
        const clubName = event.clubId?.name ?? '';
        records.push({
          id: `event:${event._id}`,
          kind: 'events',
          label: event.title,
          meta: [when, clubName].filter(Boolean).join(' · '),
          keywords: [event.location, event.description].filter(Boolean).join(' '),
          // MOCK: no event detail route exists, so the calendar is the destination.
          path: '/events',
        });
      }
    }

    recordCache = records;
    return records;
  })().finally(() => {
    recordRequest = null;
  });

  return recordRequest;
}

/* ── Recents ──────────────────────────────────────────────────────────────── */

function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is RecentEntry =>
          !!entry && typeof entry.id === 'string' && typeof entry.label === 'string' && typeof entry.path === 'string',
      )
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function writeRecent(entries: RecentEntry[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, RECENT_LIMIT)));
  } catch {
    /* a full or blocked store is not worth an error state */
  }
}

/* ── Matching ─────────────────────────────────────────────────────────────── */

function isSubsequence(needle: string, haystack: string): boolean {
  let cursor = 0;
  for (let i = 0; i < haystack.length && cursor < needle.length; i += 1) {
    if (haystack[i] === needle[cursor]) cursor += 1;
  }
  return cursor === needle.length;
}

function scoreItem(item: PaletteItem, needle: string): number | null {
  if (!needle) return 1;
  const label = item.label.toLowerCase();
  const meta = (item.meta ?? '').toLowerCase();
  const keywords = (item.keywords ?? '').toLowerCase();

  if (label === needle) return 120;
  if (label.startsWith(needle)) return 100;
  const index = label.indexOf(needle);
  if (index >= 0) return 80 - Math.min(index, 20);
  if (meta.includes(needle)) return 50;
  if (label.split(/\s+/).some((word) => word.startsWith(needle))) return 45;
  if (keywords.includes(needle)) return 25;
  if (isSubsequence(needle, label)) return 20;
  return null;
}

function rank(items: PaletteItem[], needle: string): PaletteItem[] {
  // An empty field keeps the authored order: destinations read like the rail.
  if (!needle) return items;
  return items
    .map((item) => ({ item, score: scoreItem(item, needle) }))
    .filter((entry): entry is { item: PaletteItem; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .map((entry) => entry.item);
}

/* ── Glyphs (24px grid, currentColor, no icon dependency) ─────────────────── */

const EXTRA_GLYPHS: Record<string, string> = {
  search: 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm4-2 4 4',
  keys: 'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3Z',
  recent: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  exit: 'M15 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8M14 12h7m-3-3 3 3-3 3',
};

function PaletteGlyph({ name }: { name: string }) {
  const path = NAV_ICON_PATHS[name] ?? EXTRA_GLYPHS[name] ?? EXTRA_GLYPHS.search;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d={path} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── The matched substring: weight + underline, never a highlight fill ────── */

function Marked({ text, needle }: { text: string; needle: string }): ReactElement {
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="cmd-mark">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

const groupOf = (id: string): string =>
  NAV_GROUPS.find((group) => group.items.includes(id))?.label ?? '';

const optionId = (id: string): string => `cmd-opt-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

/* ── The palette ──────────────────────────────────────────────────────────── */

export function CommandPalette() {
  const chrome = useChrome();
  const { paletteOpen, closePalette } = chrome;
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [records, setRecords] = useState<PaletteRecord[] | null>(recordCache);
  const [recordsFailed, setRecordsFailed] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const needle = query.trim().toLowerCase();

  /* Open: reset, focus the field, and remember who had focus. */
  useEffect(() => {
    if (!paletteOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    setQuery('');
    setActiveIndex(0);
    setRecents(readRecent());
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (previous && previous.isConnected) previous.focus();
    };
  }, [paletteOpen]);

  /* Records: fetched once, cached for the session. The cache dies with the shell,
     so a different account never inherits the previous one's results. */
  useEffect(() => () => { recordCache = null; }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    let alive = true;
    if (recordCache) {
      setRecords(recordCache);
      return;
    }
    fetchRecords()
      .then((next) => {
        if (alive) setRecords(next);
      })
      .catch(() => {
        if (alive) {
          setRecords([]);
          setRecordsFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [paletteOpen]);

  const navItems = useMemo<PaletteItem[]>(() => {
    if (!user) return [];
    return NAVIGATION.filter((item) => item.roles.includes(user.role)).map((item) => ({
      id: `nav:${item.id}`,
      label: item.label,
      meta: groupOf(item.id),
      group: 'Navigate',
      icon: item.icon,
      keywords: item.path.slice(1),
      path: item.path,
      run: () => navigate(item.path),
    }));
  }, [user, navigate]);

  const actions: PaletteItem[] = useMemo(() => {
    const base: PaletteItem[] = [
      {
        id: 'act:jump',
        label: 'Jump to a page',
        keys: ['/'],
        group: 'Actions',
        icon: 'search',
        keywords: 'quick jump header search',
        run: () => window.dispatchEvent(new CustomEvent('cnp:jump')),
      },
      {
        id: 'act:shortcuts',
        label: 'Keyboard shortcuts',
        keys: ['?'],
        group: 'Actions',
        icon: 'keys',
        keywords: 'keys help sheet',
        run: () => chrome.openShortcuts(),
      },
      {
        id: 'act:signout',
        label: 'Sign out',
        meta: 'Account',
        group: 'Actions',
        icon: 'exit',
        keywords: 'log out leave',
        run: () => {
          navigate('/', { replace: true });
          logout();
        },
      },
    ];

    for (const command of chrome.commands) {
      base.push({
        id: `reg:${command.id}`,
        label: command.label,
        meta: command.meta,
        group: 'Actions',
        icon: command.icon ?? 'search',
        keywords: command.keywords,
        run: command.run,
      });
    }

    return base;
  }, [chrome, logout, navigate]);

  const recordItems = useMemo<PaletteItem[]>(() => {
    if (!records) return [];
    return records.map((record) => ({
      id: `rec:${record.id}`,
      label: record.label,
      meta: record.meta,
      group: 'Records',
      icon: record.kind,
      keywords: record.keywords,
      path: record.path,
      run: () => navigate(record.path),
    }));
  }, [records, navigate]);

  const recentItems = useMemo<PaletteItem[]>(
    () =>
      recents.map((entry) => ({
        id: `recent:${entry.id}`,
        label: entry.label,
        meta: entry.meta,
        group: 'Recent',
        icon: entry.id.startsWith('rec:club:')
          ? 'clubs'
          : entry.id.startsWith('rec:project:')
            ? 'projects'
            : entry.id.startsWith('rec:event:')
              ? 'events'
              : 'recent',
        path: entry.path,
        run: () => navigate(entry.path),
      })),
    [recents, navigate],
  );

  const sections = useMemo(() => {
    const build = (group: PaletteGroup, items: PaletteItem[]) => ({
      group,
      items: rank(items, needle),
    });

    return [
      build('Navigate', navItems),
      build('Actions', actions),
      needle ? build('Records', recordItems) : { group: 'Records' as PaletteGroup, items: [] },
      build('Recent', recentItems),
    ].filter((section) => section.items.length > 0);
  }, [navItems, actions, recordItems, recentItems, needle]);

  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const active = flat[Math.min(activeIndex, Math.max(flat.length - 1, 0))] ?? null;

  useEffect(() => {
    setActiveIndex((current) => (flat.length === 0 ? 0 : Math.min(current, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    if (!paletteOpen) return;
    const row = listRef.current?.querySelector<HTMLElement>('.cmd-row.is-active');
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, paletteOpen, needle]);

  const runItem = useCallback(
    (item: PaletteItem) => {
      if (item.path) {
        const entry: RecentEntry = {
          id: item.id,
          label: item.label,
          meta: item.meta,
          path: item.path,
        };
        const next = [entry, ...readRecent().filter((recent) => recent.id !== entry.id)].slice(
          0,
          RECENT_LIMIT,
        );
        writeRecent(next);
      }
      closePalette();
      item.run();
    },
    [closePalette],
  );

  const move = (delta: number) => {
    if (flat.length === 0) return;
    setActiveIndex((current) => (current + delta + flat.length) % flat.length);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const composing = (event.nativeEvent as KeyboardEvent).isComposing;
    if (composing) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(flat.length - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (active) runItem(active);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        closePalette();
        break;
      case 'Tab':
        // Tabbing leaves the field: the palette closes rather than trapping the
        // person in a list with no next stop.
        event.preventDefault();
        closePalette();
        break;
      default:
        break;
    }
  };

  if (!paletteOpen) return null;

  const recordsNote = recordsFailed
    ? 'Records unavailable'
    : records
      ? `${records.length} records`
      : null;

  return createPortal(
    <div
      className="cmd-scrim"
      data-chrome="palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePalette();
      }}
    >
      <div
        className="cmd-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closePalette();
          }
        }}
      >
        <div className="cmd-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(active.id) : undefined}
            aria-label="Search pages, clubs, projects and events"
            placeholder="Search pages, clubs, projects, events"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
          <span className="cmd-search__hint" aria-hidden="true">
            <kbd className="ui-kbd">{MOD_LABEL}</kbd>
            <kbd className="ui-kbd">K</kbd>
          </span>
        </div>

        <div ref={listRef} className="cmd-body" id="cmd-list" role="listbox" aria-label="Results">
          {sections.map((section) => (
            <div
              className="cmd-group"
              role="group"
              aria-labelledby={`cmd-group-${section.group}`}
              key={section.group}
            >
              <p className="cmd-group__label" id={`cmd-group-${section.group}`}>
                <span>{section.group}</span>
                <span className="cmd-group__count">{section.items.length}</span>
              </p>
              {section.items.map((item) => {
                const index = flat.indexOf(item);
                const isActive = item.id === active?.id;
                return (
                  <div
                    key={item.id}
                    id={optionId(item.id)}
                    role="option"
                    aria-selected={isActive}
                    className={`cmd-row${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runItem(item)}
                  >
                    <span className="cmd-row__glyph">
                      <PaletteGlyph name={item.icon} />
                    </span>
                    <span className="cmd-row__label">
                      <Marked text={item.label} needle={needle} />
                    </span>
                    {item.meta && <span className="cmd-row__meta">{item.meta}</span>}
                    {item.keys && (
                      <span className="cmd-row__keys">
                        {item.keys.map((key) => (
                          <kbd className="ui-kbd" key={key}>
                            {key}
                          </kbd>
                        ))}
                      </span>
                    )}
                    <span className="cmd-row__go" aria-hidden="true">
                      {isActive ? <kbd className="ui-kbd">↵</kbd> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {needle && records === null && !recordsFailed && (
            <div className="cmd-status" role="status">
              Loading clubs, projects and events…
            </div>
          )}

          {flat.length === 0 && (records !== null || recordsFailed) && (
            <div className="cmd-empty">
              <p className="cmd-empty__text">
                Nothing matches <span className="cmd-empty__term">“{query.trim()}”</span>.
              </p>
              <button
                type="button"
                className="ui-btn ui-btn--quiet ui-btn--sm"
                onClick={() => {
                  setQuery('');
                  setActiveIndex(0);
                  inputRef.current?.focus();
                }}
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        <div className="cmd-foot">
          <span className="cmd-foot__keys">
            <span className="cmd-foot__hint">
              <kbd className="ui-kbd">↑</kbd>
              <kbd className="ui-kbd">↓</kbd> navigate
            </span>
            <span className="cmd-foot__hint">
              <kbd className="ui-kbd">↵</kbd> open
            </span>
            <span className="cmd-foot__hint">
              <kbd className="ui-kbd">esc</kbd> close
            </span>
          </span>
          {recordsNote && <span className="cmd-foot__count">{recordsNote}</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
