import { Fragment, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { NAVIGATION } from '../layout/Sidebar';
import { useChrome } from './ChromeContext';
import { MOD_LABEL } from './useHotkeys';
import { GO_KEY } from './routeMeta';

/* ═══════════════════════════════════════════════════════════════════════════
   Keyboard shortcuts sheet (?) and the `g` sequence chip.

   The sheet is the map. The chip is the teaching aid: pressing `g` shows the
   destinations it can reach for 1.2s, so the two-key sequences are learned
   rather than buried in documentation.
   ═══════════════════════════════════════════════════════════════════════════ */

interface KeyRowProps {
  keys: string[];
  label: string;
  /** Two-key sequence: announcement reads "g then d". */
  sequence?: boolean;
}

function KeyRow({ keys, label, sequence }: KeyRowProps) {
  return (
    <div className="keys-row">
      <span className="keys-row__label">{label}</span>
      <span className="keys-row__keys">
        {keys.map((key, index) => (
          <Fragment key={key}>
            {sequence && index > 0 && <span className="ui-visually-hidden">then</span>}
            <kbd className="ui-kbd">{key}</kbd>
          </Fragment>
        ))}
      </span>
    </div>
  );
}

interface KeyGroupProps {
  title: string;
  rows: KeyRowProps[];
}

function KeyGroup({ title, rows }: KeyGroupProps) {
  return (
    <section className="keys-group" aria-label={title}>
      <p className="keys-group__label">{title}</p>
      <div className="keys-group__rows">
        {rows.map((row) => (
          <KeyRow key={row.label} keys={row.keys} label={row.label} />
        ))}
      </div>
    </section>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Shortcuts() {
  const { shortcutsOpen, closeShortcuts } = useChrome();
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);

  const destinations = user
    ? NAVIGATION.filter((item) => item.roles.includes(user.role) && GO_KEY[item.path])
    : [];

  useEffect(() => {
    if (!shortcutsOpen) return;

    const previous = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const frame = window.requestAnimationFrame(() => modal?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeShortcuts();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;

      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === modal)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (previous && previous.isConnected) previous.focus();
    };
  }, [shortcutsOpen, closeShortcuts]);

  if (!shortcutsOpen) return null;

  return createPortal(
    <div
      className="ui-overlay"
      data-chrome="shortcuts"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeShortcuts();
      }}
    >
      <div
        ref={modalRef}
        className="ui-modal keys-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keys-title"
        aria-describedby="keys-sub"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ui-modal__head">
          <div className="keys-head">
            <h2 className="ui-h2" id="keys-title">
              Keyboard shortcuts
            </h2>
            <p className="keys-sub" id="keys-sub">
              Shortcuts pause while you are typing in a field.
            </p>
          </div>
          <button
            type="button"
            className="ui-icon-btn"
            onClick={closeShortcuts}
            aria-label="Close keyboard shortcuts"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="ui-modal__body">
          <div className="keys-grid">
            <div className="keys-col">
              <KeyGroup
                title="Navigate"
                rows={destinations.map((item) => ({
                  label: item.label,
                  keys: ['g', GO_KEY[item.path]],
                  sequence: true,
                }))}
              />
            </div>

            <div className="keys-col">
              <KeyGroup
                title="Search and palettes"
                rows={[
                  { keys: [MOD_LABEL, 'K'], label: 'Command palette' },
                  { keys: ['/'], label: 'Jump to a page' },
                  { keys: ['↑', '↓'], label: 'Move through results' },
                  { keys: ['↵'], label: 'Open the highlighted row' },
                ]}
              />
              <KeyGroup
                title="General"
                rows={[
                  { keys: ['?'], label: 'Open this sheet' },
                  { keys: ['esc'], label: 'Close the open overlay' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── The `g` chip ─────────────────────────────────────────────────────────── */

export interface SequenceItem {
  key: string;
  label: string;
}

export function SequenceChip({ open, items }: { open: boolean; items: SequenceItem[] }) {
  if (!open || items.length === 0) return null;

  return createPortal(
    <div className="seq-chip" role="status" aria-live="polite">
      <span className="seq-chip__lead">
        <kbd className="ui-kbd">g</kbd>
        <span className="seq-chip__dots" aria-hidden="true">
          …
        </span>
      </span>
      <span className="seq-chip__list">
        {items.map((item) => (
          <span className="seq-chip__item" key={item.key}>
            <kbd className="ui-kbd">{item.key}</kbd>
            <span className="seq-chip__label">{item.label}</span>
          </span>
        ))}
      </span>
    </div>,
    document.body,
  );
}
