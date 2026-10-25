import { Link } from 'react-router-dom';
import type { User } from '../../../types';
import { Tooltip } from '../../ui/Tooltip';
import { formatCompactDate } from './studentUtils';
import { ArrowRightIcon, CalendarIcon } from './StudentIcons';

interface StudentDashboardHeaderProps {
  user: User;
  onExploreClubs: () => void;
  onExploreProjects: () => void;
  /** Calendar days to the next event, derived from the upcoming-events fetch. */
  nextEventInDays?: number | null;
  /** `null` when the calendar fetch failed — the row then omits the count. */
  upcomingCount?: number | null;
  nextEventTitle?: string | null;
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The head is a name and a row of marks: the date, who you are this term, and how
 * far the next event is. No sentence — the strip below carries the shape of the
 * term, so the head does not have to describe it.
 */
export function StudentDashboardHeader({
  user,
  onExploreClubs,
  onExploreProjects,
  nextEventInDays = null,
  upcomingCount = 0,
  nextEventTitle = null,
}: StudentDashboardHeaderProps) {
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const now = new Date();

  const showsNext = upcomingCount !== null;
  const days = nextEventInDays;

  return (
    <header className="ui-page-head sd-head">
      <div className="ui-page-head__text sd-head__text">
        <h1 className="ui-title">
          {greetingFor(now.getHours())}, {firstName}
        </h1>

        <div className="sd-head__marks">
          <span className="sd-mark">
            <CalendarIcon className="sd-icon sd-icon--xs" />
            <time dateTime={now.toISOString()}>{formatCompactDate(now)}</time>
          </span>

          {user.department?.trim() ? (
            <span className="sd-mark sd-mark--chip">{user.department.trim()}</span>
          ) : null}

          {user.semester ? <span className="sd-mark sd-mark--chip">Sem {user.semester}</span> : null}

          {showsNext ? (
            upcomingCount === 0 ? (
              <Link className="sd-mark sd-mark--next" to="/events">
                No events
              </Link>
            ) : days !== null ? (
              <Tooltip
                label={
                  nextEventTitle
                    ? `${nextEventTitle} · ${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`
                    : 'Open the calendar'
                }
              >
                <Link
                  className="sd-mark sd-mark--next"
                  to="/events"
                  aria-label={
                    nextEventTitle
                      ? `Next event ${nextEventTitle}, ${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`
                      : 'Open the calendar'
                  }
                >
                  {days > 0 ? <span className="sd-mark__n">{days}</span> : null}
                  <span className="sd-mark__u">{days <= 0 ? 'today' : days === 1 ? 'day' : 'days'}</span>
                </Link>
              </Tooltip>
            ) : null
          ) : null}
        </div>
      </div>

      <div className="ui-page-actions sd-head__actions">
        <button type="button" className="ui-btn ui-btn--quiet" onClick={onExploreProjects}>
          Browse projects
        </button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onExploreClubs}>
          Browse clubs
          <ArrowRightIcon className="sd-icon sd-icon--sm sd-arrow" />
        </button>
      </div>
    </header>
  );
}
