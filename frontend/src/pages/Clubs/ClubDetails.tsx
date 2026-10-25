import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClubManagement } from '../../components/clubs/ClubManagement';
import { MemberItem } from '../../components/clubs/MemberItem';
import { Crest } from '../../components/clubs/Crest';
import { RoleMark, type RoleKind } from '../../components/clubs/RoleMark';
import { EventCard } from '../../components/events/EventCard';
import { EventForm } from '../../components/events/EventForm';
import { partitionEvents, useLocalDay } from '../../eventDate';
import { AvatarStack, Counter, DateTile, Ring, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import { usePageLoading } from '../../context/LoadingContext';
import './clubs.css';

const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 19c.6-3 2.9-4.8 5.5-4.8s4.9 1.8 5.5 4.8M16 5.4a3 3 0 0 1 0 5.6M17.4 14.6c1.8.4 3 1.9 3.4 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="m4.5 7 7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M15.5 15.5 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

function initials(name?: string) {
  if (!name) return '?';
  return name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

const timeOf = (value?: string) =>
  value ? new Date(value).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
const fullDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function ClubDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();
  const today = useLocalDay();

  const [club, setClub] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [clubEventTab, setClubEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [joinStatus, setJoinStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [memberQuery, setMemberQuery] = useState('');
  const [deletingEvent, setDeletingEvent] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const loadClubAndMembers = async () => {
    setPageLoading(true);
    try {
      // One club, with its counts and the caller's own membership, from one request.
      const c = await api<any>('GET', `/clubs/${id}`).then(res => res.data);
      if (!c) throw new Error('Not found');
      setClub(c);

      const mems = await api<any>('GET', `/clubs/${id}/members`).then(res => res.data);
      setMembers(mems);

      const evts = await api<any>('GET', `/clubs/${id}/events`).then(res => res.data).catch(() => []);
      const clubEvts = evts.filter((e: any) => {
        const eClubId = typeof e.clubId === 'object' ? e.clubId?._id : e.clubId;
        return !eClubId || eClubId === id;
      });
      const { upcoming, past } = partitionEvents(clubEvts);
      setUpcomingEvents(upcoming);
      setPastEvents(past);

      if (user?.role === 'student') {
        const reqs = await api<any>('GET', '/join-requests/student').then(res => res.data);
        const isMember = Boolean(c.myMembership) || mems.some((m: any) => m.studentId?._id === user._id);
        const hasPending = reqs.some((r: any) => r.clubId?._id === id && r.status === 'pending');
        if (isMember) setJoinStatus('member');
        else if (hasPending) setJoinStatus('pending');
        else setJoinStatus('none');
      }
    } catch (e: any) {
      alert('Error loading club details: ' + (e.message || 'Not found'));
      navigate('/clubs');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadClubAndMembers();
  }, [id, user, navigate, today]);

  useEffect(() => {
    if (!loading && window.location.hash) {
      setTimeout(() => {
        const el = document.querySelector(window.location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [loading]);

  useEffect(() => {
    if (!deletingEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) setDeletingEvent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deletingEvent, deleting]);

  useEffect(() => {
    if (!showEventForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEventForm(false);
        setEditingEvent(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEventForm]);

  /* Leaving is the same door as joining: DELETE /clubs/:id/join. Core-team seats
     are removed by a coordinator, so the API refuses those (409) and we do not
     offer the action at all. */
  const handleLeave = async () => {
    try {
      setLeaving(true);
      await api('DELETE', `/clubs/${id}/join`);
      setJoinStatus('none');
      setConfirmLeave(false);
      await loadClubAndMembers();
    } catch (e: any) {
      alert(e.message || 'Could not leave the club');
    } finally {
      setLeaving(false);
    }
  };

  const handleJoin = async () => {
    try {
      await api('POST', `/clubs/${id}/join`);
      setJoinStatus('pending');
      alert('Join request sent successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to join');
    }
  };

  const coreTeam = useMemo(() => members.filter((m) => m.membershipType === 'core_team'), [members]);
  const regularMembers = useMemo(() => members.filter((m) => m.membershipType !== 'core_team'), [members]);

  // MOCK: the composition scale counts the members array; the API exposes no aggregate on this route.
  // Suggested API: include coreTeamCount / memberCount on GET /clubs/:id

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const rank = (m: any) => (m.membershipType === 'core_team' ? 0 : 1);
      return rank(a) - rank(b) || (a.studentId?.name || '').localeCompare(b.studentId?.name || '');
    });
  }, [members]);

  const shownMembers = useMemo(() => {
    // MOCK: member search runs client side over GET /clubs/:id/members.
    // Suggested API: GET /clubs/:id/members?q=
    const q = memberQuery.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter((m) =>
      [m.studentId?.name, m.studentId?.email, m.studentId?.department, m.position]
        .filter(Boolean)
        .some((field: string) => field.toLowerCase().includes(q)),
    );
  }, [sortedMembers, memberQuery]);

  if (loading) {
    return (
      <div className="clubs-page clubs-detail" aria-busy="true" aria-label="Loading club">
        <div className="ui-skel clubs-detail__loading-back" />
        <div className="clubs-plate clubs-plate--loading">
          <div className="clubs-plate__body">
            <div className="ui-skel clubs-skel__plate" />
            <div className="clubs-skel__body">
              <div className="ui-skel clubs-skel__line clubs-skel__line--title" />
              <div className="ui-skel clubs-skel__line" />
            </div>
          </div>
        </div>
        <div className="clubs-split">
          <div className="clubs-main">
            <div className="ui-panel">
              <div className="clubs-skel clubs-skel--row">
                <div className="ui-skel clubs-skel__plate clubs-skel__plate--sm" />
                <div className="clubs-skel__body">
                  <div className="ui-skel clubs-skel__line clubs-skel__line--short" />
                </div>
              </div>
            </div>
          </div>
          <aside className="clubs-aside" aria-hidden="true">
            <div className="ui-panel" style={{ minHeight: 120 }} />
          </aside>
        </div>
      </div>
    );
  }

  if (!club) return null;

  const isCoordinator = user?.role === 'faculty_coordinator' &&
    (typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId?._id : club.facultyCoordinatorId) === user?._id;
  const isClubAdmin = user?.role === 'club_admin';
  const canManage = isCoordinator || isClubAdmin;

  const coordinator = typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId : null;
  const myMembership = members.find((m) => m.studentId?._id === user?._id);
  const coreCount = coreTeam.length;
  const regularCount = regularMembers.length;
  const coreShare = members.length ? coreCount / members.length : 0;
  const nextEvent = upcomingEvents[0] || null;
  const eventList = clubEventTab === 'upcoming' ? upcomingEvents : pastEvents;

  const rosterPreview = members
    .map((m) => ({
      name: m.studentId?.name || '',
      image: m.studentId?.profileImage ?? undefined,
      core: m.membershipType === 'core_team',
    }))
    .filter((p) => p.name);

  const myPosition =
    myMembership?.membershipType === 'core_team' && myMembership?.position &&
    myMembership.position.toLowerCase() !== 'member'
      ? myMembership.position
      : null;

  const state: { role: RoleKind; label: string } | null = isClubAdmin
    ? { role: 'admin', label: 'Club admin' }
    : isCoordinator
      ? { role: 'coordinator', label: 'Coordinator' }
      : joinStatus === 'member'
        ? myMembership?.membershipType === 'core_team'
          ? { role: 'core', label: myPosition ? `Core team · ${myPosition}` : 'Core team' }
          : { role: 'member', label: 'Member' }
        : joinStatus === 'pending'
          ? { role: 'pending', label: 'Request pending' }
          : null;

  const recordFacts = [
    club.createdAt ? `created ${fullDate(club.createdAt)}` : null,
    coordinator?.name ? `faculty coordinator ${coordinator.name}` : 'no faculty coordinator',
    joinStatus === 'member' && myMembership?.joinedAt ? `you joined ${fullDate(myMembership.joinedAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="clubs-page clubs-detail">
      <button type="button" className="clubs-back" onClick={() => navigate('/clubs')}>
        <ArrowLeft />
        All clubs
      </button>

      <section className="clubs-plate clubs-rise" style={{ '--i': 0 } as CSSProperties} aria-labelledby="club-name">
        {club.coverImage && <img className="clubs-plate__cover" src={club.coverImage} alt="" />}

        <div className="clubs-plate__body">
          <Tooltip label={recordFacts}>
            <span className="clubs-plate__crest">
              <Crest name={club.name} image={club.logo} size={92} lit={joinStatus === 'member'} />
            </span>
          </Tooltip>

          <div className="clubs-plate__id">
            <div className="clubs-plate__title-row">
              <h1 id="club-name" className="clubs-plate__name">{club.name}</h1>
              {state ? (
                <Tooltip
                  label={
                    joinStatus === 'member' && myMembership?.joinedAt
                      ? `${state.label} · joined ${fullDate(myMembership.joinedAt)}`
                      : state.label
                  }
                >
                  <span className="clubs-state" tabIndex={0}>
                    <RoleMark role={state.role} label={state.label} quiet size={14} />
                    <span>{state.label}</span>
                  </span>
                </Tooltip>
              ) : null}
            </div>

            <div className="clubs-plate__facts">
              {coordinator?.name ? (
                <Tooltip label={`${coordinator.name}${coordinator.department ? ` · ${coordinator.department}` : ''}`}>
                  {coordinator.email ? (
                    <a
                      className="clubs-chip"
                      href={`mailto:${coordinator.email}`}
                      aria-label={`Faculty coordinator ${coordinator.name}, email ${coordinator.email}`}
                    >
                      {coordinator.profileImage ? (
                        <img src={coordinator.profileImage} alt="" className="clubs-chip__face" />
                      ) : (
                        <span className="clubs-chip__face" aria-hidden="true">{initials(coordinator.name).slice(0, 1)}</span>
                      )}
                      <span className="clubs-chip__name">{coordinator.name}</span>
                      <MailIcon />
                    </a>
                  ) : (
                    <span className="clubs-chip" aria-label={`Faculty coordinator ${coordinator.name}`}>
                      {coordinator.profileImage ? (
                        <img src={coordinator.profileImage} alt="" className="clubs-chip__face" />
                      ) : (
                        <span className="clubs-chip__face" aria-hidden="true">{initials(coordinator.name).slice(0, 1)}</span>
                      )}
                      <span className="clubs-chip__name">{coordinator.name}</span>
                    </span>
                  )}
                </Tooltip>
              ) : (
                <Tooltip label="Join requests wait for a coordinator">
                  <span className="clubs-chip clubs-chip--void" aria-label="No faculty coordinator">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="clubs-void__mark">
                      <path d="M5 19 19 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      <rect x="4.5" y="4.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.6" />
                    </svg>
                  </span>
                </Tooltip>
              )}

              {rosterPreview.length > 0 ? (
                <AvatarStack people={rosterPreview} max={6} size="sm" />
              ) : null}

              <span className="clubs-plate__count">
                <Counter value={members.length} className="clubs-plate__n" />
                <span>{members.length === 1 ? 'member' : 'members'}</span>
              </span>
            </div>

            {club.description ? (
              <Tooltip label={club.description} disabled={club.description.length < 90}>
                <p className="clubs-plate__desc">{club.description}</p>
              </Tooltip>
            ) : null}
          </div>

          <div className="clubs-plate__gauge">
            <Ring value={coreShare} size={72} label={`${coreCount}/${members.length}`} caption="core" />
            {user?.role === 'student' && joinStatus === 'none' ? (
              <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={handleJoin}>
                Join club
              </button>
            ) : null}
            {user?.role === 'student' &&
            joinStatus === 'member' &&
            myMembership?.membershipType !== 'core_team' ? (
              confirmLeave ? (
                <span className="clubs-leave" role="group" aria-label="Confirm leaving this club">
                  <button
                    type="button"
                    className="ui-btn ui-btn--danger ui-btn--sm"
                    onClick={handleLeave}
                    disabled={leaving}
                  >
                    {leaving ? 'Leaving…' : 'Confirm leave'}
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--quiet ui-btn--sm"
                    onClick={() => setConfirmLeave(false)}
                    disabled={leaving}
                  >
                    Stay
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="ui-btn ui-btn--quiet ui-btn--sm"
                  onClick={() => setConfirmLeave(true)}
                  title="Leave this club; you can request to join again"
                >
                  Leave club
                </button>
              )
            ) : null}
          </div>
        </div>
      </section>

      {canManage && (
        <div className="clubs-rise" style={{ '--i': 1 } as CSSProperties}>
          <ClubManagement club={club} onUpdate={loadClubAndMembers} />
        </div>
      )}

      <div className="clubs-split">
        <div className="clubs-main">
          <section
            className="ui-panel clubs-rise"
            style={{ '--i': 2 } as CSSProperties}
            id="club-members"
            aria-labelledby="club-members-title"
          >
            <header className="ui-panel__head clubs-head">
              <div className="ui-panel__titles">
                <h2 id="club-members-title" className="ui-panel__title">Members</h2>
                <span className="ui-panel__meta">{members.length}</span>
              </div>
              {members.length > 6 && (
                <div className="ui-search clubs-members__search">
                  <SearchIcon />
                  <input
                    className="ui-field"
                    type="search"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Find a member"
                    aria-label="Search members"
                  />
                </div>
              )}
            </header>

            <div className="ui-panel__body ui-panel__body--flush">
              {shownMembers.length > 0 ? (
                <div className="clubs-members">
                  {shownMembers.map((m) => (
                    <MemberItem
                      key={m._id}
                      m={m}
                      clubId={club._id}
                      canManage={canManage}
                      onRefresh={loadClubAndMembers}
                    />
                  ))}
                </div>
              ) : (
                <div className="ui-panel__body">
                  <div className="ui-empty clubs-empty-inline">
                    <span className="ui-empty__mark"><UsersIcon /></span>
                    <p className="ui-empty__title">
                      {members.length ? 'No member matches that search' : 'No members yet'}
                    </p>
                    {!members.length ? (
                      <p className="ui-empty__text">Students join from the directory; approved requests land here.</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section
            className="ui-panel clubs-rise"
            style={{ '--i': 3 } as CSSProperties}
            aria-labelledby="club-events-title"
          >
            <header className="ui-panel__head clubs-head">
              <div className="ui-panel__titles">
                <h2 id="club-events-title" className="ui-panel__title">Events</h2>
                <span className="ui-panel__meta">{eventList.length}</span>
              </div>
              <div className="clubs-members__tools">
                <div className="ui-seg" role="group" aria-label="Event period">
                  <button type="button" aria-pressed={clubEventTab === 'upcoming'} onClick={() => setClubEventTab('upcoming')}>
                    Upcoming
                  </button>
                  <button type="button" aria-pressed={clubEventTab === 'past'} onClick={() => setClubEventTab('past')}>
                    Past
                  </button>
                </div>
                {canManage && !showEventForm && (
                  <button
                    type="button"
                    className="ui-btn ui-btn--quiet ui-btn--sm"
                    onClick={() => {
                      setEditingEvent(null);
                      setShowEventForm(true);
                    }}
                  >
                    Add event
                  </button>
                )}
              </div>
            </header>

            <div className="ui-panel__body ui-panel__body--flush">
              <div className="ui-panel__body">
                {eventList.length > 0 ? (
                  <div className="clubs-events">
                    {eventList.map((e) => (
                      <EventCard
                        key={e._id}
                        event={{
                          ...e,
                          clubId: typeof e.clubId === 'object' && e.clubId ? e.clubId : club,
                        }}
                        canManage={canManage}
                        isPast={clubEventTab === 'past'}
                        onEdit={(evt) => {
                          setEditingEvent(evt);
                          setShowEventForm(true);
                        }}
                        onDelete={(eventId) => {
                          const found = [...upcomingEvents, ...pastEvents].find((x) => x._id === eventId);
                          setDeletingEvent({ id: eventId, title: found?.title || 'this event' });
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="ui-empty clubs-empty-inline">
                    <span className="ui-empty__mark"><CalendarIcon /></span>
                    <p className="ui-empty__title">No {clubEventTab} events</p>
                    {canManage && clubEventTab === 'upcoming' ? (
                      <button
                        type="button"
                        className="ui-btn ui-btn--quiet ui-btn--sm"
                        onClick={() => { setEditingEvent(null); setShowEventForm(true); }}
                      >
                        Add event
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </section>

          {(club.images && club.images.length > 0) && (
            <section
              className="ui-panel clubs-rise"
              style={{ '--i': 4 } as CSSProperties}
              aria-labelledby="club-gallery-title"
            >
              <header className="ui-panel__head clubs-head">
                <div className="ui-panel__titles">
                  <h2 id="club-gallery-title" className="ui-panel__title">Gallery</h2>
                  <span className="ui-panel__meta">{club.images.length}</span>
                </div>
              </header>
              <div className="ui-panel__body">
                <div className="clubs-gallery">
                  {club.images.map((img: any, i: number) => (
                    <img
                      key={i}
                      src={typeof img === 'string' ? img : img.url}
                      alt={`${club.name} gallery image ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="clubs-aside" aria-label="Club instruments">
          {nextEvent && (
            <section className="ui-panel clubs-rise" style={{ '--i': 5 } as CSSProperties}>
              <header className="ui-panel__head clubs-head">
                <div className="ui-panel__titles">
                  <h2 className="ui-panel__title">Next up</h2>
                </div>
              </header>
              <div className="ui-panel__body ui-panel__body--tight">
                <div className="clubs-next">
                  <DateTile date={nextEvent.eventDate || nextEvent.date} tone="accent" size="md" />
                  <div className="clubs-next__text">
                    <p className="clubs-next__title">{nextEvent.title}</p>
                    <p className="clubs-next__meta">
                      {timeOf(nextEvent.eventDate || nextEvent.date)}
                      {nextEvent.location ? ` · ${nextEvent.location}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="ui-panel clubs-rise" style={{ '--i': nextEvent ? 6 : 5 } as CSSProperties}>
            <header className="ui-panel__head clubs-head">
              <div className="ui-panel__titles">
                <h2 className="ui-panel__title">Core team</h2>
                <span className="ui-panel__meta">{coreCount}</span>
              </div>
            </header>
            <div className="ui-panel__body ui-panel__body--tight clubs-card-panel">
              <div className="clubs-comp">
                <Segments
                  value={coreCount}
                  total={members.length}
                  segments={14}
                  tone="ramp"
                  ariaLabel={`${coreCount} of ${members.length} members sit on the core team`}
                />
                <div className="clubs-comp__legend" aria-hidden="true">
                  <span className="clubs-comp__dot" />
                  <span className="clubs-comp__k">core</span>
                  <span className="clubs-comp__n">{coreCount}</span>
                  <span className="clubs-comp__dot clubs-comp__dot--rest" />
                  <span className="clubs-comp__k">others</span>
                  <span className="clubs-comp__n">{regularCount}</span>
                </div>
              </div>

              {coreTeam.length ? (
                <div className="clubs-core">
                  {coreTeam.map((m) => (
                    <Tooltip
                      key={m._id}
                      label={`${m.studentId?.name || 'Member'}${m.position ? ` · ${m.position}` : ''}`}
                    >
                      <span className="clubs-core__av" tabIndex={0}>
                        {m.studentId?.profileImage ? (
                          <img src={m.studentId.profileImage} alt="" className="clubs-core__face" />
                        ) : (
                          <span className="clubs-core__face" aria-hidden="true">
                            {initials(m.studentId?.name)}
                          </span>
                        )}
                        {m.position ? <span className="clubs-core__seal" aria-hidden="true" /> : null}
                      </span>
                    </Tooltip>
                  ))}
                </div>
              ) : (
                <p className="clubs-comp__void">No core team seats yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showEventForm && (
        <div
          className="ui-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowEventForm(false);
              setEditingEvent(null);
            }
          }}
        >
          <div className="ui-modal ui-modal--wide" role="dialog" aria-modal="true" aria-labelledby="clubs-event-form-title">
            <div className="ui-modal__head">
              <div>
                <h2 id="clubs-event-form-title" className="ui-panel__title">
                  {editingEvent ? 'Edit event' : 'New event'}
                </h2>
              </div>
              <button
                type="button"
                className="ui-icon-btn"
                onClick={() => { setShowEventForm(false); setEditingEvent(null); }}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
            <EventForm
              clubId={id!}
              event={editingEvent}
              onSave={() => {
                setShowEventForm(false);
                setEditingEvent(null);
                loadClubAndMembers();
              }}
              onCancel={() => {
                setShowEventForm(false);
                setEditingEvent(null);
              }}
            />
          </div>
        </div>
      )}

      {deletingEvent && (
        <div
          className="ui-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) setDeletingEvent(null); }}
        >
          <div className="ui-modal ui-modal--narrow" role="dialog" aria-modal="true" aria-labelledby="clubs-delete-event-title">
            <div className="ui-modal__head">
              <h2 id="clubs-delete-event-title" className="ui-panel__title">Delete event</h2>
              <button type="button" className="ui-icon-btn" onClick={() => setDeletingEvent(null)} disabled={deleting} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="ui-modal__body">
              <p className="clubs-modal__danger-text">
                <strong>{deletingEvent.title}</strong> will be removed from the club and the department calendar.
                This cannot be undone.
              </p>
            </div>
            <div className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setDeletingEvent(null)} disabled={deleting}>
                Keep event
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--danger"
                disabled={deleting}
                onClick={async () => {
                  try {
                    setDeleting(true);
                    await api('DELETE', `/events/${deletingEvent.id}`);
                    setUpcomingEvents(prev => prev.filter(x => x._id !== deletingEvent.id));
                    setPastEvents(prev => prev.filter(x => x._id !== deletingEvent.id));
                    setDeletingEvent(null);
                  } catch (err: any) {
                    alert(err.message || 'Failed to delete event');
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Deleting…' : 'Delete event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
