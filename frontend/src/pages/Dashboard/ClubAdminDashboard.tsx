import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Counter, Ring, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  DashAvatar,
  DashEmpty,
  DashEventsPanel,
  DashIcon,
  DashLoadError,
  DashNotifications,
  DashPlate,
  riseStyle,
} from './StaffBits';

interface ClubAdminStats {
  totalClubs: number;
  withCoordinator: number;
  withoutCoordinator: number;
}

interface ClubAdminDashboardProps {
  clubs: any[];
  stats: ClubAdminStats | null;
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

/**
 * Club admin — the coverage map. Coverage is a gauge; every club is a tile whose
 * coordinator slot is either filled or a hatched gap, and pending join requests
 * are tally marks on the map itself rather than a separate list of sentences.
 */
export function ClubAdminDashboard({
  clubs,
  stats,
  requests,
  upcomingEvents,
  pastEvents,
  unread,
  loadError,
  onReload,
  onDeleteEvent,
}: ClubAdminDashboardProps) {
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const total = stats?.totalClubs ?? clubs.length;
  const withCoordinator =
    stats?.withCoordinator ?? clubs.filter((club) => Boolean(club.facultyCoordinatorId)).length;
  const withoutCoordinator =
    stats?.withoutCoordinator ?? clubs.filter((club) => !club.facultyCoordinatorId).length;
  const members = useMemo(
    () => clubs.reduce((sum, club) => sum + (club.totalMembers ?? club.memberCount ?? 0), 0),
    [clubs],
  );
  const coreMembers = useMemo(
    () => clubs.reduce((sum, club) => sum + (club.coreTeamCount ?? 0), 0),
    [clubs],
  );
  // MOCK: per-club request counts are grouped in the browser; see docs/mocks/staff-dashboards.md
  const pendingByClub = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of requests) {
      const id = clubIdOf(request);
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [requests]);

  // MOCK: coverage is a client-side ratio of two counts already in the payload
  const coverage = total > 0 ? Math.min(withCoordinator / total, 1) : 0;
  const coverageTone = withoutCoordinator > 0 ? 'warning' : 'accent';

  /* Programme roster: one block per club, width by real member count, hatched
     where the coordinator slot is empty. */
  // MOCK: roster widths and gap marks are derived from the /clubs payload
  const rostered = useMemo(
    () =>
      [...clubs]
        .map((club) => ({
          club,
          size: club.totalMembers ?? club.memberCount ?? 0,
          covered: Boolean(club.facultyCoordinatorId),
        }))
        .sort((a, b) => b.size - a.size),
    [clubs],
  );

  return (
    <div className="dash dash--cover">
      <header className="ui-page-head">
        <div className="ui-page-head__text">
          <h1 className="ui-title">Club programme</h1>
        </div>
        <div className="ui-page-actions">
          <DashNotifications count={unread} />
          <Link to="/clubs" className="ui-btn ui-btn--primary">
            Manage clubs
          </Link>
        </div>
      </header>

      {loadError ? <DashLoadError message={loadError} onRetry={onReload} /> : null}

      {clubs.length ? (
        <section
          className="dash-cover-band dash-rise"
          aria-labelledby="ca-coverage-title"
          style={riseStyle(0)}
        >
          <div className="dash-cover-band__gauge">
            <Ring
              value={coverage}
              size={96}
              tone={coverageTone}
              label={`${withCoordinator}/${total}`}
              caption="covered"
            />
            <div className="dash-cover-band__read">
              <p className="dash-cover-band__value">
                <Counter value={withoutCoordinator} />
              </p>
              <p className="dash-cover-band__label">
                {withoutCoordinator === 1 ? 'gap' : 'gaps'}
              </p>
            </div>
          </div>

          <div className="dash-cover-band__roster">
            <h2 className="ui-visually-hidden" id="ca-coverage-title">
              Coordinator coverage
            </h2>
            <div
              className="dash-roster"
              role="img"
              aria-label={`${total} clubs, ${withCoordinator} with a faculty coordinator, ${members} members`}
            >
              {rostered.map(({ club, size, covered }) => (
                <Tooltip
                  key={club._id}
                  label={`${club.name}: ${size} member${size === 1 ? '' : 's'}, ${
                    covered
                      ? club.facultyCoordinatorId?.name || 'coordinator assigned'
                      : 'no faculty coordinator'
                  }`}
                >
                  <span
                    className="dash-roster__block"
                    data-gap={!covered || undefined}
                    role="img"
                    aria-label={`${club.name}: ${size} members, ${
                      covered ? 'coordinator assigned' : 'no faculty coordinator'
                    }`}
                    tabIndex={0}
                    style={{ '--dash-grow': Math.max(size, 0) } as CSSProperties}
                  >
                    <span className="dash-roster__n" aria-hidden="true">
                      {size}
                    </span>
                  </span>
                </Tooltip>
              ))}
            </div>

            <div className="dash-cover-band__foot">
              <span className="dash-cover-band__count">
                <Counter value={members} />
                <span className="dash-cover-band__unit">members</span>
              </span>
              <span className="dash-cover-band__spacer" />
              <span className="dash-cover-band__core">core</span>
              <Tooltip label={`${coreMembers} in core teams of ${members} members`}>
                <span className="dash-cover-band__meter" tabIndex={0}>
                  <Segments
                    value={coreMembers}
                    total={members}
                    segments={10}
                    tone="ramp"
                    ariaLabel={`${coreMembers} in core teams of ${members} members`}
                  />
                </span>
              </Tooltip>
            </div>
          </div>
        </section>
      ) : null}

      <section className="dash-region dash-rise" aria-labelledby="ca-map-title" style={riseStyle(1)}>
        <header className="dash-region__head">
          <h2 className="dash-region__title" id="ca-map-title">
            Clubs
          </h2>
          <span className="dash-region__n">
            <Counter value={total} />
          </span>
          <span className="dash-region__spacer" />
          <Link to="/clubs" className="ui-btn ui-btn--ghost ui-btn--sm">
            Open directory
          </Link>
        </header>

        {clubs.length ? (
          <ul className="dash-map">
            {clubs.map((club) => {
              const clubMembers = club.totalMembers ?? club.memberCount ?? 0;
              const core = club.coreTeamCount ?? 0;
              const pending = pendingByClub.get(club._id) ?? 0;
              const coordinator =
                club.facultyCoordinatorId && typeof club.facultyCoordinatorId === 'object'
                  ? club.facultyCoordinatorId
                  : null;
              return (
                <li className={`dash-tile dash-tile--map${coordinator ? '' : ' is-gap'}`} key={club._id}>
                  <Link
                    to={`/clubs/${club._id}`}
                    className="dash-tile__link"
                    aria-label={`${club.name}, ${clubMembers} members, ${
                      coordinator ? `coordinator ${coordinator.name}` : 'no faculty coordinator'
                    }`}
                  />
                  <div className="dash-tile__top">
                    <DashPlate name={club.name} src={club.logo} size={36} />
                    <span className="dash-tile__name">{club.name}</span>
                    {pending > 0 ? (
                      <Tooltip label={`${pending} join request${pending === 1 ? '' : 's'} waiting`}>
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
                  </div>

                  <div className="dash-tile__roster">
                    <span className="dash-tile__n">
                      <Counter value={clubMembers} />
                    </span>
                    <span className="dash-tile__label">members</span>
                    <Tooltip label={`${core} of ${clubMembers} in the core team`}>
                      <span className="dash-tile__scale">
                        <Segments
                          value={core}
                          total={clubMembers}
                          segments={6}
                          tone="ramp"
                          ariaLabel={`${core} of ${clubMembers} in the core team`}
                        />
                      </span>
                    </Tooltip>
                    <span className="dash-tile__core">
                      <span className="dash-tile__core-n">{core}</span> core
                    </span>
                  </div>

                  {coordinator ? (
                    <div className="dash-slot">
                      <DashAvatar name={coordinator.name} src={coordinator.profileImage} size="sm" />
                      <span className="dash-slot__name">{coordinator.name}</span>
                      <span className="dash-slot__mark" aria-hidden="true">
                        <DashIcon name="check" size={13} />
                      </span>
                      <span className="ui-visually-hidden">Faculty coordinator assigned</span>
                    </div>
                  ) : (
                    <div className="dash-slot is-empty">
                      <span className="dash-slot__hatch" aria-hidden="true" />
                      <span className="dash-slot__warn" aria-hidden="true">
                        <DashIcon name="alert" size={14} />
                      </span>
                      <span className="dash-slot__gap">No coordinator</span>
                      <Link to={`/clubs/${club._id}`} className="dash-slot__assign">
                        Assign
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <DashEmpty
            icon="clubs"
            title="No clubs yet"
            text="Create the first club to start the programme."
            action={
              <Link to="/clubs" className="ui-btn ui-btn--quiet ui-btn--sm">
                Manage clubs
              </Link>
            }
          />
        )}
      </section>

      <div className="dash-rise" style={riseStyle(2)}>
        <DashEventsPanel
          idPrefix="ca-events"
          upcoming={upcomingEvents}
          past={pastEvents}
          tab={eventTab}
          onTab={setEventTab}
          canAdd={!showEventForm}
          showForm={showEventForm}
          editing={editingEvent}
          availableClubs={clubs}
          formClubId={
            editingEvent && typeof editingEvent.clubId === 'object'
              ? editingEvent.clubId?._id
              : editingEvent?.clubId
          }
          onAdd={() => {
            setEditingEvent(null);
            setShowEventForm(true);
          }}
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
