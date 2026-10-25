import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClubForm } from '../../components/clubs/ClubForm';
import { StudentClubCard } from '../../components/clubs/StudentClubCard';
import { Crest } from '../../components/clubs/Crest';
import { RoleMark, type RoleKind } from '../../components/clubs/RoleMark';
import { Counter, Bars, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import { usePageLoading } from '../../context/LoadingContext';
import './clubs.css';

interface RosterMember {
  name: string;
  image?: string | null;
  core: boolean;
  position?: string | null;
}

interface Club {
  _id: string;
  name: string;
  description?: string;
  logo?: string | null;
  coverImage?: string | null;
  images?: string[];
  facultyCoordinatorId?: any;
  totalMembers?: number;
  memberCount?: number;
  coreTeamCount?: number;
  regularMemberCount?: number;
  createdAt?: string;
  rosterPreview?: RosterMember[];
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M15.5 15.5 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const DirectoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export default function Clubs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setPageLoading } = usePageLoading();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [membersByClub, setMembersByClub] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'mine'>('all');

  // Student specific state
  const [myMemberships, setMyMemberships] = useState<Record<string, any>>({});
  const [myPending, setMyPending] = useState<Record<string, boolean>>({});

  const loadClubs = async () => {
    setPageLoading(true);
    setError('');
    try {
      const res = await api<any>('GET', '/clubs');
      const allClubs: Club[] = res.data;
      setClubs(allClubs);

      // The roster is fetched once per club — the documented N+1. It feeds the
      // avatar stacks here as well as the student's membership map, so the club
      // admin sees the same faces the student does.
      const rosterEntries = await Promise.all(
        allClubs.map((c) =>
          api<any>('GET', `/clubs/${c._id}/members`)
            .then((r) => [c._id, r.data ?? []] as const)
            .catch(() => [c._id, [] as any[]] as const),
        ),
      );
      const rosters: Record<string, any[]> = {};
      rosterEntries.forEach(([clubId, list]) => {
        rosters[clubId] = list;
      });
      setMembersByClub(rosters);

      if (user?.role === 'student') {
        const reqs = await api<any>('GET', '/join-requests/student').then((r) => r.data);

        const pendingMap: Record<string, boolean> = {};
        reqs.forEach((r: any) => {
          if (r.status === 'pending' && r.clubId) {
            pendingMap[typeof r.clubId === 'object' ? r.clubId._id : r.clubId] = true;
          }
        });
        setMyPending(pendingMap);

        // The directory already carries the caller's own membership per club
        // (`myMembership`), so this is a read, not a scan of every roster. The
        // roster scan stays as a fallback for older cached payloads.
        const memberMap: Record<string, any> = {};
        allClubs.forEach((club: any) => {
          if (club.myMembership) memberMap[club._id] = club.myMembership;
        });
        if (Object.keys(memberMap).length === 0) {
          Object.entries(rosters).forEach(([clubId, list]) => {
            const me = list.find((x: any) => x.studentId?._id === user._id);
            if (me) memberMap[clubId] = me;
          });
        }
        setMyMemberships(memberMap);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Could not load the club directory.');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadClubs();
  }, [user]);

  const isStudent = user?.role === 'student';
  const canCreate = user?.role === 'club_admin';
  const joinedCount = Object.keys(myMemberships).length;

  const coordinatorCount = useMemo(() => {
    const ids = new Set<string>();
    clubs.forEach((c) => {
      const coord = typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId : null;
      if (coord?._id) ids.add(coord._id);
    });
    return ids.size;
  }, [clubs]);

  const totalMembers = useMemo(
    () => clubs.reduce((sum, c) => sum + (c.memberCount ?? c.totalMembers ?? 0), 0),
    [clubs],
  );

  const coreTeamTotal = useMemo(
    () => clubs.reduce((sum, c) => sum + (c.coreTeamCount ?? 0), 0),
    [clubs],
  );

  const coveredClubs = useMemo(
    () => clubs.filter((c) => (typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId?._id : c.facultyCoordinatorId)).length,
    [clubs],
  );

  // MOCK: search and the All / My clubs filter run over the full GET /clubs response.
  // Suggested API: GET /clubs?q=&scope=joined
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (scope === 'mine' && !myMemberships[c._id]) return false;
      if (!q) return true;
      const coord = typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId : null;
      return [c.name, c.description, coord?.name, coord?.department]
        .filter(Boolean)
        .some((field: string) => field.toLowerCase().includes(q));
    });
  }, [clubs, query, scope, myMemberships]);

  // MOCK: the featured club is chosen client side — the newest club the student belongs to,
  // else the newest club by createdAt (the API order is not contractual).
  // Suggested API: GET /clubs?featured=1 or a `featured` flag on the club record.
  const { lead, rest } = useMemo(() => {
    const byNewest = [...visible].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    const featured = (isStudent && byNewest.find((c) => myMemberships[c._id])) || byNewest[0] || null;
    return {
      lead: featured,
      rest: featured ? visible.filter((c) => c._id !== featured._id) : [],
    };
  }, [visible, isStudent, myMemberships]);

  const filtersActive = query.trim().length > 0 || scope !== 'all';

  const myClubs = useMemo(
    () => clubs.filter((c) => myMemberships[c._id]),
    [clubs, myMemberships],
  );

  const coordinatorList = useMemo(() => {
    // MOCK: coordinator → clubs grouping is derived from the directory payload.
    // Suggested API: GET /clubs/coordinators
    type CoordinatorEntry = {
      _id: string;
      name: string;
      department?: string;
      profileImage?: string | null;
      clubs: { _id: string; name: string }[];
    };
    const map = new Map<string, CoordinatorEntry>();
    clubs.forEach((c) => {
      const coord = typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId : null;
      if (!coord?._id || !coord?.name) return;
      const entry: CoordinatorEntry = map.get(coord._id) || {
        _id: coord._id,
        name: coord.name,
        department: coord.department,
        profileImage: coord.profileImage,
        clubs: [],
      };
      entry.clubs.push({ _id: c._id, name: c.name });
      map.set(coord._id, entry);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [clubs]);

  const pendingRole = (clubId: string): { role: RoleKind; label: string } | null =>
    myPending[clubId] ? { role: 'pending', label: 'Request pending' } : null;

  const roleOf = (clubId: string): { role: RoleKind; label: string } | null => {
    const pending = pendingRole(clubId);
    if (pending) return pending;
    const membership = myMemberships[clubId];
    if (!membership) return null;
    if (membership.membershipType === 'core_team') {
      const position = membership.position && membership.position.toLowerCase() !== 'member' ? membership.position : null;
      return { role: 'core', label: position ? `Core team · ${position}` : 'Core team' };
    }
    return { role: 'member', label: 'Member' };
  };

  const cardTag = (club: Club): string | undefined => {
    if (user?.role === 'club_admin') return 'Admin';
    if (user?.role === 'faculty_coordinator') {
      const coordId = typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId?._id : club.facultyCoordinatorId;
      if (coordId === user._id) return 'Coordinator';
    }
    return undefined;
  };

  const rosterPreview = (clubId: string): RosterMember[] =>
    (membersByClub[clubId] ?? [])
      .map((m) => ({
        name: m.studentId?.name ?? '',
        image: m.studentId?.profileImage ?? null,
        core: m.membershipType === 'core_team',
        position: m.position ?? null,
      }))
      .filter((p) => p.name);

  const renderCard = (club: Club, isLead = false) => (
    <StudentClubCard
      key={club._id}
      club={{ ...club, rosterPreview: rosterPreview(club._id) }}
      membership={myMemberships[club._id] || null}
      pending={!!myPending[club._id]}
      tag={cardTag(club)}
      lead={isLead}
      onClick={() => navigate(`/clubs/${club._id}`)}
    />
  );

  const indexCells = [
    { label: 'clubs', value: clubs.length },
    { label: 'members', value: totalMembers },
    { label: 'core team', value: coreTeamTotal },
    { label: 'coordinators', value: coordinatorCount },
  ];

  return (
    <div className="clubs-page">
      <header className="ui-page-head clubs-rise" style={{ '--i': 0 } as CSSProperties}>
        <div className="ui-page-head__text">
          <h1 className="ui-title">Clubs</h1>
        </div>

        <div className="ui-page-actions clubs-actions">
          <div className="ui-search clubs-search">
            <SearchIcon />
            <input
              id="clubs-search"
              className="ui-field"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clubs"
              aria-label="Search clubs by name, description or coordinator"
            />
          </div>

          {isStudent && (
            <div className="ui-seg" role="group" aria-label="Filter the directory">
              <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
                All
              </button>
              <button type="button" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
                My clubs{joinedCount ? ` ${joinedCount}` : ''}
              </button>
            </div>
          )}

          {canCreate && !showForm && (
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setShowForm(true)}>
              New club
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="clubs-index clubs-index--loading clubs-rise" style={{ '--i': 1 } as CSSProperties} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div className="clubs-index__cell" key={i}>
              <span className="ui-skel clubs-index__skel" />
            </div>
          ))}
        </div>
      ) : !error && clubs.length > 0 ? (
        <section
          className="clubs-index clubs-rise"
          style={{ '--i': 1 } as CSSProperties}
          aria-label="Directory totals"
        >
          <div className="clubs-index__cells">
            {indexCells.map((cell) => (
              <div className="clubs-index__cell" key={cell.label}>
                <Counter value={cell.value} className="clubs-index__n" />
                <span className="clubs-index__k">{cell.label}</span>
              </div>
            ))}
          </div>

          <div className="clubs-index__meter">
            <Tooltip
              label={`${coreTeamTotal} of ${totalMembers} members hold a core-team seat`}
            >
              <span className="clubs-index__meter-track">
                <Segments
                  value={coreTeamTotal}
                  total={totalMembers}
                  segments={28}
                  tone="ramp"
                  ariaLabel={`${coreTeamTotal} of ${totalMembers} members hold a core-team seat`}
                />
              </span>
            </Tooltip>
            <div className="clubs-index__legend" aria-hidden="true">
              <span className="clubs-index__key" />
              <span className="clubs-index__keyk">core</span>
              <span className="clubs-index__keyn">{coreTeamTotal}</span>
              <span className="clubs-index__key clubs-index__key--rest" />
              <span className="clubs-index__keyk">others</span>
              <span className="clubs-index__keyn">{Math.max(0, totalMembers - coreTeamTotal)}</span>
            </div>
          </div>
        </section>
      ) : null}

      {showForm && (
        <ClubForm
          onSave={() => { setShowForm(false); loadClubs(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error ? (
        <div className="clubs-error clubs-rise" style={{ '--i': 2 } as CSSProperties}>
          <div className="ui-notice ui-notice--error" role="alert">
            <span>{error}</span>
          </div>
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={loadClubs}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="clubs-layout clubs-layout--loading" aria-busy="true" aria-label="Loading clubs">
          <section className="clubs-board">
            <div className="clubs-skel clubs-skel--lead">
              <div className="ui-skel clubs-skel__plate" />
              <div className="clubs-skel__body">
                <div className="ui-skel clubs-skel__line clubs-skel__line--title" />
                <div className="ui-skel clubs-skel__line" />
                <div className="ui-skel clubs-skel__line clubs-skel__line--short" />
              </div>
            </div>
            {[0, 1, 2].map((i) => (
              <div className="clubs-skel clubs-skel--row" key={i}>
                <div className="ui-skel clubs-skel__plate clubs-skel__plate--sm" />
                <div className="clubs-skel__body">
                  <div className="ui-skel clubs-skel__line clubs-skel__line--title" />
                </div>
              </div>
            ))}
          </section>
          <aside className="clubs-aside" aria-hidden="true">
            <div className="ui-panel">
              <div className="clubs-skel clubs-skel--row">
                <div className="ui-skel clubs-skel__plate clubs-skel__plate--sm" />
                <div className="clubs-skel__body">
                  <div className="ui-skel clubs-skel__line clubs-skel__line--short" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : clubs.length === 0 ? (
        <div className="ui-empty clubs-empty clubs-rise" style={{ '--i': 2 } as CSSProperties}>
          <span className="ui-empty__mark"><DirectoryIcon /></span>
          <p className="ui-empty__title">No clubs yet</p>
          <p className="ui-empty__text">
            {canCreate
              ? 'Clubs appear here as soon as they are created. Start the first one.'
              : 'The department has not published a student-managed club yet.'}
          </p>
          {canCreate && !showForm && (
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setShowForm(true)}>
              New club
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="ui-empty clubs-empty clubs-rise" style={{ '--i': 2 } as CSSProperties}>
          <span className="ui-empty__mark"><SearchIcon /></span>
          <p className="ui-empty__title">No clubs match this view</p>
          <p className="ui-empty__text">
            {scope === 'mine' && !query.trim()
              ? 'You have not joined a club yet.'
              : `Nothing in ${clubs.length} clubs matches “${query.trim()}”.`}
          </p>
          <button
            type="button"
            className="ui-btn ui-btn--quiet ui-btn--sm"
            onClick={() => { setQuery(''); setScope('all'); }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="clubs-layout">
          <section
            className="clubs-board clubs-rise"
            style={{ '--i': 2 } as CSSProperties}
            aria-label={filtersActive ? 'Filtered clubs' : 'Club directory'}
          >
            {lead && renderCard(lead, true)}
            {rest.length > 0 && (
              <div className="clubs-board__index">
                {rest.map((club) => renderCard(club))}
              </div>
            )}

            {filtersActive && (
              <footer className="clubs-board__foot">
                <span className="clubs-board__count">
                  {visible.length} / {clubs.length}
                </span>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  onClick={() => { setQuery(''); setScope('all'); }}
                >
                  Clear
                </button>
              </footer>
            )}
          </section>

          <aside className="clubs-aside" aria-label="Directory instruments">
            {isStudent ? (
              <section className="ui-panel clubs-rise" style={{ '--i': 3 } as CSSProperties}>
                <header className="ui-panel__head">
                  <div className="ui-panel__titles">
                    <h2 className="ui-panel__title">Your clubs</h2>
                    <span className="ui-panel__meta">{myClubs.length}</span>
                  </div>
                </header>
                <div className="ui-panel__body clubs-mine">
                  {myClubs.length ? (
                    <div className="clubs-mine__rail">
                      {myClubs.map((club) => {
                        const role = roleOf(club._id);
                        return (
                          <Tooltip key={club._id} label={`${club.name} · ${role?.label ?? 'Member'}`}>
                            <button
                              type="button"
                              className="clubs-mine__tile"
                              onClick={() => navigate(`/clubs/${club._id}`)}
                              aria-label={`${club.name}, ${role?.label ?? 'Member'}`}
                            >
                              <Crest name={club.name} image={club.logo} size={44} lit />
                              {role ? (
                                <RoleMark
                                  role={role.role}
                                  label={role.label}
                                  quiet
                                  size={12}
                                  className="clubs-mine__mark"
                                />
                              ) : null}
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="clubs-mine__empty">
                      <span className="clubs-hatch clubs-hatch--void" aria-hidden="true" />
                      <p className="ui-meta">No memberships yet.</p>
                      <button
                        type="button"
                        className="ui-btn ui-btn--quiet ui-btn--sm"
                        onClick={() => setScope('all')}
                      >
                        Browse clubs
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="ui-panel clubs-rise" style={{ '--i': 3 } as CSSProperties}>
                <header className="ui-panel__head">
                  <div className="ui-panel__titles">
                    <h2 className="ui-panel__title">Members</h2>
                    <span className="ui-panel__meta">{totalMembers}</span>
                  </div>
                </header>
                <div className="ui-panel__body clubs-rank">
                  <Bars
                    data={[...clubs]
                      .sort((a, b) => (b.memberCount ?? b.totalMembers ?? 0) - (a.memberCount ?? a.totalMembers ?? 0))
                      .map((club) => ({
                        label: club.name,
                        value: club.memberCount ?? club.totalMembers ?? 0,
                        hint: `${club.coreTeamCount ?? 0} core team of ${club.memberCount ?? club.totalMembers ?? 0}`,
                      }))}
                    tone="ramp"
                    ariaLabel={`Members per club, ${totalMembers} in total`}
                  />
                </div>
              </section>
            )}
          </aside>

          <section className="ui-panel clubs-coverage-panel clubs-rise" style={{ '--i': 3 } as CSSProperties}>
            <header className="ui-panel__head">
              <div className="ui-panel__titles">
                <h2 className="ui-panel__title">Coordinators</h2>
                <span className="ui-panel__meta">{coordinatorList.length}</span>
              </div>
            </header>
            <div className="ui-panel__body clubs-coverage">
              <div className="clubs-coverage__rail">
                <Tooltip
                  label={`${coveredClubs} of ${clubs.length} clubs have a faculty coordinator`}
                >
                  <span className="clubs-coverage__meter">
                    <Segments
                      value={coveredClubs}
                      total={clubs.length}
                      segments={12}
                      tone="ramp"
                      ariaLabel={`${coveredClubs} of ${clubs.length} clubs have a faculty coordinator`}
                    />
                  </span>
                </Tooltip>
                {clubs.length - coveredClubs > 0 ? (
                  <Tooltip
                    label={`${clubs.length - coveredClubs} ${clubs.length - coveredClubs === 1 ? 'club has' : 'clubs have'} no faculty coordinator`}
                  >
                    <span className="clubs-hatch clubs-hatch--void" tabIndex={0} aria-label="Uncovered clubs" />
                  </Tooltip>
                ) : null}
                <span className="clubs-coverage__ratio">
                  {coveredClubs}/{clubs.length}
                  <span className="ui-visually-hidden"> clubs have a faculty coordinator</span>
                </span>
              </div>

              {coordinatorList.length ? (
                <ul className="clubs-coordlist">
                  {coordinatorList.map((coord) => (
                    <li className="clubs-coord" key={coord._id}>
                      {coord.profileImage ? (
                        <img src={coord.profileImage} alt="" className="ui-avatar ui-avatar--sm" />
                      ) : (
                        <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                          {coord.name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                        </span>
                      )}
                      <span className="clubs-coord__text">
                        <span className="clubs-coord__name">{coord.name}</span>
                        {coord.department ? <span className="clubs-coord__dept">{coord.department}</span> : null}
                      </span>
                      <span className="clubs-coord__clubs">
                        {coord.clubs.map((club) => (
                          <Tooltip key={club._id} label={club.name}>
                            <button
                              type="button"
                              className="clubs-coord__crest"
                              onClick={() => navigate(`/clubs/${club._id}`)}
                              aria-label={club.name}
                            >
                              <Crest name={club.name} size={22} />
                            </button>
                          </Tooltip>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="clubs-coverage__void">No faculty coordinator assigned.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
