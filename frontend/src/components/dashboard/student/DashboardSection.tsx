import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from './StudentIcons';

interface DashboardSectionProps {
  id: string;
  title: string;
  /** A count or a short state beside the title. Never a sentence. */
  meta?: ReactNode;
  actionLabel?: string;
  /** Navigates (preferred) or fires a callback. */
  actionTo?: string;
  onAction?: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * A region of the dashboard: one label row, then either an object or ruled
 * rows. No panel frame — the page draws hierarchy with a single rule and open
 * space, so regions cannot nest inside one another.
 */
export function DashboardSection({
  id,
  title,
  meta,
  actionLabel,
  actionTo,
  onAction,
  className = '',
  children,
}: DashboardSectionProps) {
  const actionClass = 'sd-region__action';

  return (
    <section className={`sd-region ${className}`.trim()} aria-labelledby={`${id}-heading`}>
      <header className="sd-region__head">
        <h2 className="sd-region__title" id={`${id}-heading`}>
          {title}
        </h2>
        {meta !== undefined && meta !== null ? <span className="sd-region__meta">{meta}</span> : null}
        {actionLabel && actionTo ? (
          <Link className={actionClass} to={actionTo}>
            {actionLabel}
            <ArrowRightIcon className="sd-icon sd-icon--xs sd-arrow" />
          </Link>
        ) : actionLabel && onAction ? (
          <button type="button" className={actionClass} onClick={onAction}>
            {actionLabel}
            <ArrowRightIcon className="sd-icon sd-icon--xs sd-arrow" />
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/**
 * A failed fetch stated in place, without pretending the rest of the page is
 * empty. One word is enough here: the page's notice already carries the message
 * and the retry, and four copies of it would be noise. The detail stays in the
 * accessible name.
 */
export function PanelError({ message }: { message: string }) {
  return (
    <div className="sd-region__state">
      <p className="sd-region__empty sd-region__empty--error" role="status">
        Unavailable
        <span className="ui-visually-hidden">: {message}</span>
      </p>
    </div>
  );
}
