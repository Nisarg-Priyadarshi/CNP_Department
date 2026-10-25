import { Link } from 'react-router-dom';
import { Ring } from '../../ui/vis';
import { DashboardSection, PanelError } from './DashboardSection';
import {
  calendarDaysUntil,
  closenessFor,
  clubLogoOf,
  clubNameOf,
  countdownFor,
  eventDateValue,
  formatClock,
  formatCompactDate,
  formatDayNumber,
  formatMonthShort,
  formatWeekday,
  initialsOf,
  type StudentEvent,
} from './studentUtils';
import { ClockIcon, PinIcon } from './StudentIcons';

interface StudentUpcomingEventsProps {
  events: StudentEvent[];
  error?: string;
}

/**
 * The next event is the page's one object: a ticket with a counterfoil date
 * block, a perforated seam, and a countdown gauge. Everything else about the
 * event is a mark on it, not a sentence about it.
 */
export function StudentUpcomingEvents({ events, error }: StudentUpcomingEventsProps) {
  const next = events[0] ?? null;
  const date = next ? eventDateValue(next) : null;
  const days = next?.eventDate ? calendarDaysUntil(next.eventDate) : null;
  const when = countdownFor(days);
  const club = next ? clubNameOf(next) : null;
  const logo = next ? clubLogoOf(next) : null;
  const closeness = closenessFor(days);

  const ringLabel = days === null ? 'TBA' : days <= 0 ? 'now' : String(days);
  const unit = days === null ? 'date' : days <= 0 ? 'today' : days === 1 ? 'day' : 'days';

  const aria = next
    ? [
        next.title,
        club,
        date ? formatCompactDate(date) : 'date to be announced',
        date ? formatClock(date) : null,
        next.location,
        when ? when.sentence : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <DashboardSection
      id="sd-next"
      title="Next up"
      meta={events.length > 0 ? `${events.length} ahead` : undefined}
      className="sd-next"
    >
      {error ? (
        <PanelError message={error} />
      ) : !next ? (
        <div className="sd-region__state">
          <p className="sd-region__empty">No upcoming events.</p>
          <Link className="ui-btn ui-btn--quiet ui-btn--sm" to="/events">
            Browse events
          </Link>
        </div>
      ) : (
        <Link className="sd-ticket" to="/events" aria-label={aria}>
          <span className="sd-stub" aria-hidden="true">
            <span className="sd-stub__wd">{date ? formatWeekday(date) : 'Date'}</span>
            <span className="sd-stub__day">{date ? formatDayNumber(date) : '--'}</span>
            <span className="sd-stub__mo">{date ? formatMonthShort(date) : 'TBA'}</span>
          </span>

          <span className="sd-ticket__perf" aria-hidden="true">
            <span className="sd-ticket__notch sd-ticket__notch--top" />
            <span className="sd-ticket__notch sd-ticket__notch--bottom" />
          </span>

          <span className="sd-ticket__body">
            <span className="sd-ticket__club">
              {logo ? (
                <span className="sd-ticket__crest">
                  <img src={logo} alt="" />
                </span>
              ) : (
                <span className="sd-ticket__crest">{initialsOf(club ?? 'Campus')}</span>
              )}
              <span className="sd-ticket__club-name">{club ?? 'Campus calendar'}</span>
            </span>

            <span className="sd-ticket__title">{next.title}</span>

            <span className="sd-ticket__facts">
              {next.location ? (
                <span className="sd-ticket__fact">
                  <PinIcon className="sd-icon sd-icon--sm" />
                  <span className="ui-truncate">{next.location}</span>
                </span>
              ) : null}
              <span className="sd-ticket__fact">
                <ClockIcon className="sd-icon sd-icon--sm" />
                <span>{date ? formatClock(date) : 'Time TBA'}</span>
              </span>
            </span>
          </span>

          <span className="sd-ticket__count">
            <Ring value={closeness} size={64} tone="accent" label={ringLabel} />
            <span className="sd-ticket__unit">{unit}</span>
          </span>
        </Link>
      )}
    </DashboardSection>
  );
}
