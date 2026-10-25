import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Counter, DateTile, Ring } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  DashEventsPanel,
  DashEmpty,
  DashQuiet,
  DashIcon,
  DashLoadError,
  DashNotifications,
  DashAvatar,
  DashPlate,
  parseDate,
  riseStyle,
  shortAge,
  spokenAge,
} from './StaffBits';

interface CoordinatorDashboardProps {
  clubs: any[];
  clubsError: string | null;
  requests: any[];
  upcomingEvents: any[];
  pastEvents: any[];
  unread: number;
  loadError: string | null;
  onReload: () => void;
  onDeleteEvent: (id: string) => void;
}

const clubIdOf = (request: any) =>
  request.clubId && typeof request.clubId === 'object' ? request.clubId._id : request.clubId;

/** Age bucket 0–3: fresh, a day, a few days, a week or more. */
function ageBucket(value: string | null | undefined): number {
  const date = parseDate(value);
  if (!date) return 0;
  const hours = (Date.now() - date.getTime()) / 3_600_000;
  if (hours < 24) return 0;
  if (hours < 72) return 1;
  if (hours < 168) return 2;
  return 3;
}

/**
 * Faculty coordinator — the queue. Clubs are tiles with a composition ring;
 * the join requests are a physical inbox with a depth ruler, an age tick per
 * item and the oldest slip in focus.
 */
export function CoordinatorDashboard({
  clubs,
  clubsError,
  requests,
  upcomingEvents,
  pastEvents,
  unread,
  loadError,
  onReload,
  onDeleteEvent,
}: CoordinatorDashboardProps) {
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  // MOCK: pending counts per club are grouped in the browser; see docs/mocks/staff-dashboards.md
  const pendingByClub = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of requests) {
      const id = clubIdOf(request);
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [requests]);

  // MOCK: the merged per-club queue is ordered and age-ticked in the browser;
  // see docs/mocks/staff-dashboards.md
  const inbox = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
      ),
    [requests],
  );

  const clubNameOf = (request: any) => {
    const id = clubIdOf(request);
    return (
      request.clubId?.name ||
      clubs.find((club) => club._id === id)?.name ||
      'Assigned club'
    );
  };

  const firstClubId = inbox.length ? clubIdOf(inbox[0]) || clubs[0]?._id : clubs[0]?._id;
  const nextEvent = upcomingEvents[0];

  // A real 14-day occupancy strip built from the upcoming events already fetched.
  // MOCK: day grouping happens in the browser; see docs/mocks/staff-dashboards.md
  const fortnight = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() + index);
      const events = upcomingEvents.filter((event) => {
        const date = parseDate(event.eventDate || event.date);
        return (
          date &&
          date.getFullYear() === day.getFullYear() &&
          date.getMonth() === day.getMonth() &&
          date.getDate() === day.getDate()
        );
      });
      return { day, events };
    });
  }, [upcomingEvents]);
  const peak = Math.max(1, ...fortnight.map((entry) => entry.events.length));

  const openForm = () => {
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const oldestAge = inbox.length ? shortAge(inbox[0].createdAt) : '—';
  const depthSlots = 8;

  return (
    <div className="dash dash--coord">
      <header className="ui-page-head">
        <div className="ui-page-head__text">
          <h1 className="ui-title">Clubs I guide</h1>
        </div>
        <div className="ui-page-actions">
          <DashNotifications count={unread} />
          {inbox.length > 0 && firstClubId ? (
            <Link to={`/clubs/${firstClubId}#join-requests`} className="ui-btn ui-btn--primary">
              Review {inbox.length} request{inbox.length === 1 ? '' : 's'}
            </Link>
          ) : (
            <Link to="/events" className="ui-btn ui-btn--primary">
              Manage events
            </Link>
          )}
        </div>
      </header>

      {loadError ? <DashLoadError message={loadError} onRetry={onReload} /> : null}
      {clubsError ? <DashLoadError message={clubsError} onRetry={onReload} /> : null}

      <section className="dash-region dash-rise" aria-labelledby="fc-clubs-title" style={riseStyle(0)}>
        <header className="dash-region__head">
          <h2 className="dash-region__title" id="fc-clubs-title">
            Clubs
          </h2>
          <span className="dash-region__n">
            <Counter value={clubs.length} />
          </span>
          <span className="dash-region__spacer" />
          <Link to="/clubs" className="ui-btn ui-btn--ghost ui-btn--sm">
            Directory
          </Link>
        </header>

        {clubs.length ? (
          <ul className="dash-tiles">
            {clubs.map((club) => {
              const total = club.totalMembers ?? club.memberCount ?? 0;
              const core = club.coreTeamCount ?? 0;
              const pending = pendingByClub.get(club._id) ?? 0;
              const share = total > 0 ? Math.min(core / total, 1) : 0;
              return (
                <li className="dash-tile" key={club._id}>
                  <Link
                    to={`/clubs/${club._id}`}
                    className="dash-tile__link"
                    aria-label={`${club.name}, ${total} members, ${core} in the core team`}
                  />
                  <DashPlate name={club.name} src={club.logo} size={44} />
                  <div className="dash-tile__id">
                    <span className="dash-tile__name">{club.name}</span>
                    <span className="dash-tile__facts">
                      <span>
                        <span className="dash-tile__n">{total}</span> members
                      </span>
                      {pending > 0 ? (
                        <Tooltip
                          label={`${pending} join request${pending === 1 ? '' : 's'} waiting`}
                        >
                          <Link
                            to={`/clubs/${club._id}#join-requests`}
                            className="dash-tally is-warning"
                          >
                            <span className="dash-tally__dot" aria-hidden="true" />
                            {pending}
                            <span className="ui-visually-hidden">
                              {' '}
                              join request{pending === 1 ? '' : 's'} waiting
                            </span>
                          </Link>
                        </Tooltip>
                      ) : null}
                    </span>
                  </div>
                  <span className="dash-tile__gauge">
                    <Ring
                      value={share}
                      size={56}
                      tone="ink"
                      label={total > 0 ? `${core}/${total}` : '0'}
                      caption="core"
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <DashEmpty
            icon="clubs"
            title="No clubs assigned yet"
            text="A club admin assigns each faculty coordinator."
          />
        )}
      </section>

      <div className="dash-split">
        <section
          className="ui-panel dash-inbox dash-rise"
          aria-labelledby="fc-queue-title"
          style={riseStyle(1)}
        >
          <header className="ui-panel__head">
            <div className="ui-panel__titles">
              <h2 className="ui-panel__title" id="fc-queue-title">
                Inbox
              </h2>
              <span className="ui-panel__meta">
                <Counter value={inbox.length} />
              </span>
              {inbox.length ? <span className="dash-live" aria-hidden="true" /> : null}
            </div>
            {inbox.length > 0 && firstClubId ? (
              <Link
                to={`/clubs/${firstClubId}#join-requests`}
                className="ui-btn ui-btn--ghost ui-btn--sm"
              >
                Open queue
              </Link>
            ) : null}
          </header>

          {inbox.length ? (
            <>
              <Tooltip
                label={`${inbox.length} request${inbox.length === 1 ? '' : 's'} waiting · oldest ${spokenAge(
                  inbox[0].createdAt,
                )}`}
              >
                <div
                  className="dash-depth"
                  role="img"
                  aria-label={`${inbox.length} requests waiting, oldest ${spokenAge(
                    inbox[0].createdAt,
                  )}`}
                >
                  <span className="dash-depth__track">
                    {Array.from({ length: depthSlots }, (_, index) => {
                      const request = inbox[index];
                      return (
                        <span
                          className="dash-depth__slot"
                          key={index}
                          data-age={request ? ageBucket(request.createdAt) : undefined}
                          data-empty={request ? undefined : true}
                          data-oldest={request && index === 0 ? true : undefined}
                        />
                      );
                    })}
                  </span>
                  <span className="dash-depth__axis">
                    <span>oldest {oldestAge}</span>
                    <span>
                      {inbox.length > depthSlots ? `+${inbox.length - depthSlots} · ` : ''}
                      now
                    </span>
                  </span>
                </div>
              </Tooltip>

              <ol className="dash-slip-list">
                {inbox.slice(0, 6).map((request, index) => {
                  const id = clubIdOf(request);
                  const student = request.studentId;
                  const focus = index === 0;
                  return (
                    <li className={`dash-slip${focus ? ' is-focus' : ''}`} key={request._id}>
                      {focus ? <span className="dash-slip__edge" aria-hidden="true" /> : null}
                      <DashAvatar name={student?.name} src={student?.profileImage} size={focus ? 'md' : 'sm'} />
                      <div className="dash-slip__main">
                        <p className="dash-slip__name">{student?.name || 'Unknown student'}</p>
                        <p className="dash-slip__meta">
                          {clubNameOf(request)}
                          {student?.department ? (
                            <>
                              <span className="dash-ev__dot" aria-hidden="true" />
                              {student.department}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <span className="dash-slip__wait" title={spokenAge(request.createdAt)}>
                        <span
                          className="dash-slip__age"
                          data-age={ageBucket(request.createdAt)}
                          aria-hidden="true"
                        />
                        {shortAge(request.createdAt)}
                        <span className="ui-visually-hidden">
                          {' '}
                          waiting, {spokenAge(request.createdAt)}
                        </span>
                      </span>
                      {id ? (
                        <Link
                          to={`/clubs/${id}#join-requests`}
                          className={`ui-btn ui-btn--quiet ui-btn--sm dash-slip__go${
                            focus ? ' is-focus' : ''
                          }`}
                        >
                          Review
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              {inbox.length > 6 ? (
                <footer className="ui-panel__foot">
                  <span className="dash-at">{inbox.length - 6} more waiting</span>
                  {firstClubId ? (
                    <Link
                      to={`/clubs/${firstClubId}#join-requests`}
                      className="ui-btn ui-btn--ghost ui-btn--sm"
                    >
                      Open queue
                    </Link>
                  ) : null}
                </footer>
              ) : null}
            </>
          ) : (
            <div className="ui-panel__body">
              <DashQuiet
                icon="check"
                title={clubs.length ? 'Inbox clear' : 'Requests land here'}
                text={
                  clubs.length
                    ? 'Every join request for your clubs has been answered.'
                    : 'Student requests for your clubs will queue here.'
                }
              />
            </div>
          )}
        </section>

        <section
          className="dash-next dash-rise"
          aria-labelledby="fc-next-title"
          style={riseStyle(2)}
        >
          <header className="dash-region__head">
            <h2 className="dash-region__title" id="fc-next-title">
              Next
            </h2>
            <span className="dash-region__n">
              <Counter value={upcomingEvents.length} />
            </span>
            <span className="dash-region__spacer" />
            <Link to="/events" className="ui-btn ui-btn--ghost ui-btn--sm">
              <DashIcon name="calendar" size={14} />
              Calendar
            </Link>
          </header>

          {nextEvent ? (
            <Link to="/events" className="dash-next__event">
              <DateTile date={nextEvent.eventDate || nextEvent.date} size="lg" tone="accent" />
              <span className="dash-next__text">
                <span className="dash-next__title">{nextEvent.title || 'Untitled event'}</span>
                <span className="dash-next__meta">
                  {nextEvent.clubId?.name || 'Department club'}
                  {nextEvent.location ? (
                    <>
                      <span className="dash-ev__dot" aria-hidden="true" />
                      {nextEvent.location}
                    </>
                  ) : null}
                </span>
              </span>
            </Link>
          ) : (
            <p className="dash-next__empty">Nothing scheduled</p>
          )}

          <div className="dash-week">
            {fortnight.map((entry) => {
              const count = entry.events.length;
              const isToday = entry.day.getTime() === new Date().setHours(0, 0, 0, 0);
              const label = `${entry.day.toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ', no events'}`;
              const cell = (
                <span
                  className="dash-week__cell"
                  data-today={isToday || undefined}
                  data-fill={count > 0 || undefined}
                  aria-hidden="true"
                >
                  <span
                    className="dash-week__bar"
                    style={{ '--dash-h': count / peak } as CSSProperties}
                  />
                  <span className="dash-week__day">{entry.day.getDate()}</span>
                </span>
              );
              return count ? (
                <Tooltip
                  key={entry.day.toISOString()}
                  label={`${label}: ${entry.events.map((event: any) => event.title).join(', ')}`}
                >
                  <span className="dash-week__hit" role="img" aria-label={label} tabIndex={0}>
                    {cell}
                  </span>
                </Tooltip>
              ) : (
                <span className="dash-week__hit" key={entry.day.toISOString()} role="img" aria-label={label}>
                  {cell}
                </span>
              );
            })}
          </div>
          <p className="dash-week__legend">
            <span>Today</span>
            <span>+13 days</span>
          </p>
        </section>
      </div>

      <div className="dash-rise" style={riseStyle(3)}>
        <DashEventsPanel
          idPrefix="fc-events"
          upcoming={upcomingEvents}
          past={pastEvents}
          tab={eventTab}
          onTab={setEventTab}
          canAdd={clubs.length > 0}
          showForm={showEventForm}
          editing={editingEvent}
          formClubId={
            editingEvent && typeof editingEvent.clubId === 'object'
              ? editingEvent.clubId?._id
              : editingEvent?.clubId || clubs[0]?._id
          }
          onAdd={openForm}
          onEdit={(event) => {
            setEditingEvent(event);
            setShowEventForm(true);
          }}
          onDelete={onDeleteEvent}
          onSave={() => {
            setShowEventForm(false);
            setEditingEvent(null);
            onReload();
          }}
          onCancel={() => {
            setShowEventForm(false);
            setEditingEvent(null);
          }}
        />
      </div>
    </div>
  );
}
