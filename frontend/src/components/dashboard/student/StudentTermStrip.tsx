import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip } from '../../ui/Tooltip';
import { DashboardSection, PanelError } from './DashboardSection';
import {
  TERM_WEEKS,
  addDays,
  buildTermWindow,
  formatClock,
  formatCompactDate,
  formatDayMonth,
  type StudentEvent,
  type TermDay,
} from './studentUtils';

interface StudentTermStripProps {
  events: StudentEvent[];
  error?: string;
}

/** One line per event: the tooltip is where the day's detail lives. */
function dayTip(day: TermDay): string {
  const head = formatCompactDate(day.date);
  const items = day.events
    .slice(0, 4)
    .map((event) => {
      const date = event.eventDate ? new Date(event.eventDate) : null;
      const time = date && !Number.isNaN(date.getTime()) ? formatClock(date) : 'Time TBA';
      return `${time} ${event.title}`;
    });
  const more = day.events.length > 4 ? ` · +${day.events.length - 4} more` : '';
  return `${head} — ${items.join(' · ')}${more}`;
}

/**
 * The term as a shape: six weeks, Monday first, one tick per day, the real
 * events standing on their real date, and one cobalt mark for now. It replaces
 * the sentence "3 events this term, next in 7 days" with the thing itself.
 */
export function StudentTermStrip({ events, error }: StudentTermStripProps) {
  const term = buildTermWindow(events);
  const total = TERM_WEEKS * 7;
  const pct = (index: number) => `${((index + 0.5) / total) * 100}%`;
  const edge = (index: number) => `${(index / total) * 100}%`;
  const today = term.days.find((day) => day.isToday);
  const withEvents = term.days.filter((day) => day.events.length > 0);
  /* `end` is exclusive; the horizon's last plotted day is the one before it. */
  const last = addDays(term.end, -1);

  const summary =
    events.length === 0
      ? `No events between ${formatDayMonth(term.start)} and ${formatDayMonth(last)}`
      : `${term.placed} ${term.placed === 1 ? 'event' : 'events'} in the ${TERM_WEEKS} weeks from ${formatDayMonth(term.start)} to ${formatDayMonth(last)}`;

  return (
    <DashboardSection
      id="sd-term"
      title="Your term"
      meta={events.length > 0 ? `${events.length} events` : undefined}
      actionLabel="Calendar"
      actionTo="/events"
      className="sd-term"
    >
      {error ? (
        <PanelError message={error} />
      ) : (
        <>
          <div
            className="sd-term__plot"
            role="group"
            aria-label={summary}
            style={{ '--sd-day': `${100 / total}%` } as CSSProperties}
          >
            {term.weeks.slice(1).map((week, weekIndex) => (
              <span
                key={week.toISOString()}
                className="sd-term__rule"
                style={{ '--sd-x': edge((weekIndex + 1) * 7) } as CSSProperties}
                aria-hidden="true"
              />
            ))}

            {today ? (
              <span
                className="sd-term__today"
                style={{ '--sd-x': pct(today.index) } as CSSProperties}
                aria-hidden="true"
              />
            ) : null}

            <div className="sd-term__ticks" aria-hidden="true">
              {term.days.map((day) => (
                <span
                  key={day.key}
                  className="sd-term__tick"
                  data-week={day.isWeekStart || undefined}
                  data-today={day.isToday || undefined}
                />
              ))}
            </div>

            {today ? (
              <span
                className="sd-term__now"
                style={{ '--sd-x': pct(today.index) } as CSSProperties}
                aria-hidden="true"
              >
                <span className="sd-term__now-label">now</span>
              </span>
            ) : null}

            {withEvents.map((day) => (
              <Tooltip key={day.key} label={dayTip(day)}>
                <Link
                  className="sd-term__mark"
                  to="/events"
                  style={{ '--sd-x': pct(day.index) } as CSSProperties}
                  aria-label={`${day.events.length} ${day.events.length === 1 ? 'event' : 'events'} on ${formatCompactDate(day.date)}: ${day.events
                    .map((event) => event.title)
                    .join(', ')}`}
                >
                  <span className="sd-term__stack">
                    {day.events.slice(0, 5).map((event) => (
                      <span className="sd-term__bar" key={event._id} />
                    ))}
                  </span>
                </Link>
              </Tooltip>
            ))}

            {term.later.length > 0 ? (
              <Tooltip
                label={`${term.later.length} more after ${formatDayMonth(last)}: ${term.later
                  .slice(0, 3)
                  .map((event) => event.title)
                  .join(' · ')}`}
              >
                <Link
                  className="sd-term__later"
                  to="/events"
                  aria-label={`${term.later.length} more events after ${formatDayMonth(last)}`}
                >
                  +{term.later.length}
                </Link>
              </Tooltip>
            ) : null}
          </div>

          <ol className="sd-term__weeks" aria-hidden="true">
            {term.weeks.map((week) => (
              <li key={week.toISOString()}>{formatDayMonth(week)}</li>
            ))}
          </ol>

          {events.length === 0 ? <p className="sd-term__empty">Nothing scheduled this term.</p> : null}
        </>
      )}
    </DashboardSection>
  );
}
