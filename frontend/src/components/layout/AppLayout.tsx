import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar, NAVIGATION } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { ChromeProvider, useChrome } from '../ui/ChromeContext';
import { SequenceChip } from '../ui/Shortcuts';
import { useHotkeys, type HotkeyBinding } from '../ui/useHotkeys';
import { GO_KEY, useDocumentMeta } from '../ui/routeMeta';
import './shell.css';

/**
 * The frame every signed-in route is drawn inside: a graphite rail, a light header,
 * and one scrollable content column. Pages render into `.shell-content` with no
 * outer margins of their own.
 *
 * The chrome layer (command palette, shortcuts sheet, the `g` chip) is mounted
 * around the frame, never inside the keyed route wrapper, so navigation cannot
 * remount it and an overlay cannot survive a page swap.
 */
export function AppLayout() {
  return (
    <ChromeProvider>
      <ShellFrame />
    </ChromeProvider>
  );
}

/** A page's own dialog owns the keyboard while it is open. Chrome overlays are
    marked so they can be excluded: the palette and the sheet manage themselves. */
function pageDialogOpen(): boolean {
  const nodes = document.querySelectorAll<HTMLElement>('.ui-overlay, [aria-modal="true"]');
  for (const node of nodes) {
    if (!node.closest('[data-chrome]')) return true;
  }
  return false;
}

function ShellFrame() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openPalette, openShortcuts, paletteOpen, shortcutsOpen } = useChrome();

  useDocumentMeta();

  // A route change always leaves the drawer behind.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  /** Closing by keyboard or scrim returns focus to the control that opened it. */
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.hdr-menu-toggle')?.focus();
    });
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;

    // The drawer is modal on small screens: focus lands inside it.
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.rail-close')?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen, closeDrawer]);

  const destinations = useMemo(
    () =>
      user
        ? NAVIGATION.filter((item) => item.roles.includes(user.role) && GO_KEY[item.path])
        : [],
    [user],
  );

  const bindings = useMemo<HotkeyBinding[]>(() => {
    const list: HotkeyBinding[] = [
      {
        combo: 'mod+k',
        allowInInputs: true,
        allowInOverlay: true,
        run: () => openPalette(),
      },
      {
        combo: '?',
        run: () => openShortcuts(),
      },
    ];

    for (const item of destinations) {
      const key = GO_KEY[item.path];
      list.push({
        combo: `g ${key}`,
        run: () => navigate(item.path),
      });
    }

    return list;
  }, [destinations, navigate, openPalette, openShortcuts]);

  const { prefix } = useHotkeys(bindings, {
    overlayOpen: paletteOpen || shortcutsOpen,
    blocked: pageDialogOpen,
  });

  const sequenceItems = destinations.map((item) => ({
    key: GO_KEY[item.path],
    label: item.label,
  }));

  return (
    <>
      <div className={`shell${drawerOpen ? ' is-drawer-open' : ''}`}>
        <aside className="shell-rail" id="shell-rail" aria-label="Primary navigation">
          <Sidebar onClose={closeDrawer} />
        </aside>

        {drawerOpen && <div className="shell-scrim" onClick={closeDrawer} aria-hidden="true" />}

        <div className="shell-main">
          <Header
            drawerOpen={drawerOpen}
            onToggleMenu={() => (drawerOpen ? closeDrawer() : openDrawer())}
          />
          <main className="shell-content" id="content-area" aria-labelledby="shell-page-title">
            {/* Keyed on the path: content rises 4px and fades; the shell never moves. */}
            <div className="route-enter" key={location.pathname}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <SequenceChip open={prefix === 'g'} items={sequenceItems} />
    </>
  );
}
