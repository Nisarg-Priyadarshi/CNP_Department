import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectForm } from '../../components/projects/ProjectForm';
import { usePageLoading } from '../../context/LoadingContext';
import { AvatarStack, Counter, KindGlyph, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import './projects.css';

/* ── Shapes the API returns ───────────────────────────────────────────────── */

interface ProjectPerson {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  semester?: number | null;
  profileImage?: string | null;
}

interface ProjectRecord {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  image?: string | null;
  teamLeaderId?: ProjectPerson | string | null;
  /** Server-counted roster size — the truth even when the roster is capped. */
  memberCount?: number;
  /** The caller's own place: leading | member | mentor | none. */
  myRelation?: 'leading' | 'member' | 'mentor' | 'none';
  createdAt?: string;
  updatedAt?: string;
}

interface MemberRecord {
  _id: string;
  studentId?: ProjectPerson | string | null;
}

interface JoinRequestRecord {
  _id: string;
  projectId?: { _id?: string } | string | null;
  status?: string;
}

type StatusKey = 'active' | 'completed' | 'inactive';

const STATUS_ORDER: StatusKey[] = ['active', 'completed', 'inactive'];

const STATUS_LABEL: Record<StatusKey, string> = {
  active: 'Active',
  completed: 'Completed',
  inactive: 'Inactive',
};

const STATUS_NOTE: Record<StatusKey, string> = {
  active: 'Work in progress',
  completed: 'Delivered and closed',
  inactive: 'Paused for now',
};

type RelationKey = 'lead' | 'member' | 'pending';

function statusKey(status?: string): StatusKey {
  return status === 'completed' || status === 'inactive' ? status : 'active';
}

function personOf(value?: ProjectPerson | string | null): ProjectPerson | null {
  return value && typeof value === 'object' ? value : null;
}

function initialOf(name?: string): string {
  return (name || '?').replace(/^Dr\.\s*/i, '').trim().charAt(0).toUpperCase() || '?';
}

/* Two letters, like the club boards: Campus Energy Monitor reads CE. */
function monogram(name?: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* ── Marks ────────────────────────────────────────────────────────────────── */

function SearchMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ArrowMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m-5.5-5.5L19 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* The lead glyph: a crown on a 12px grid, so it stays crisp at 11–14px —
   "this person leads" reads the same on a row, a chip and a roster. */
function LeadMark({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2.6 8.3 2 3.3l2.4 1.8L6 2.6l1.6 2.5L10 3.3l-.6 5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M2.6 10.2h6.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* Waiting on a decision: a dashed ring on a 12px grid. It is the only mark in
   the set that is open rather than solid, so "not yet a member" reads as a state
   before the tooltip is opened. */
function PendingMark({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
      <circle cx="6" cy="6" r="1.15" fill="currentColor" />
    </svg>
  );
}

function FolderMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4l1.6 2H18.5A1.5 1.5 0 0 1 20 9.5v7A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The monogram plate on a row, with the status as a corner cut. */
function Plate({ project, status }: { project: ProjectRecord; status: StatusKey }) {
  return (
    <span className={`prj-plate is-${status}`} aria-hidden="true">
      {project.image ? <img src={project.image} alt="" /> : monogram(project.name)}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function Projects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, ProjectPerson[]>>({});
  const [pendingProjectIds, setPendingProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusKey>('all');
  const [openGroups, setOpenGroups] = useState<Record<StatusKey, boolean>>({
    active: true,
    completed: false,
    inactive: false,
  });

  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();
  const newProjectTrigger = useRef<HTMLButtonElement>(null);
  const closeForm = () => {
    setShowForm(false);
    newProjectTrigger.current?.focus();
  };

  const loadProjects = async () => {
    setPageLoading(true);
    try {
      setError(null);
      let list: ProjectRecord[] = [];
      if (user?.role === 'faculty_mentor') {
        const res = await api<any>('GET', `/mentors/${user._id}/projects`);
        list = (res.data || []).map((m: any) => m.project).filter(Boolean);
      } else {
        const res = await api<any>('GET', '/projects');
        list = res.data || [];
      }
      setProjects(list);

      // MOCK: GET /projects carries no roster, so team size and "your relation" are
      // joined client-side from the per-project member list (one call per project).
      // Suggested API: include member ids/count on GET /projects, or GET /projects?mine=1.
      const [rosters, pending] = await Promise.all([
        Promise.all(
          list.map((project) =>
            api<any>('GET', `/projects/${project._id}/members`)
              .then((res) => ({ id: project._id, members: res.data || [] }))
              .catch(() => ({ id: project._id, members: [] as MemberRecord[] })),
          ),
        ),
        user?.role === 'student'
          ? api<any>('GET', '/join-requests/student')
              .then((res) => (res.data || []) as JoinRequestRecord[])
              .catch(() => [] as JoinRequestRecord[])
          : Promise.resolve([] as JoinRequestRecord[]),
      ]);

      const index: Record<string, ProjectPerson[]> = {};
      rosters.forEach(({ id, members }) => {
        index[id] = (members as MemberRecord[])
          .map((member) => personOf(member.studentId))
          .filter((person): person is ProjectPerson => Boolean(person));
      });
      setMembersByProject(index);

      setPendingProjectIds(
        pending
          .filter((request) => request.status === 'pending')
          .map((request) => {
            const project = request.projectId;
            return typeof project === 'object' && project ? project._id || '' : String(project || '');
          })
          .filter(Boolean),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to load projects');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const decorated = useMemo(
    () =>
      projects.map((project) => {
        const leader = personOf(project.teamLeaderId);
        const members = membersByProject[project._id] || [];
        return {
          project,
          status: statusKey(project.status),
          leader,
          members,
          pending: pendingProjectIds.includes(project._id),
        };
      }),
    [projects, membersByProject, pendingProjectIds],
  );

  // MOCK: GET /projects takes no query, so search and the status filter run over the
  // fetched list. Suggested API: GET /projects?q=&status=.
  const searched = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return decorated;
    return decorated.filter(({ project, leader }) =>
      [project.name, project.description, leader?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [decorated, query]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusKey, number> = { active: 0, completed: 0, inactive: 0 };
    decorated.forEach(({ status }) => {
      counts[status] += 1;
    });
    return counts;
  }, [decorated]);

  const visibleStatuses = STATUS_ORDER.filter((status) => statusCounts[status] > 0);

  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: searched.filter((item) => item.status === status),
  })).filter(
    (group) =>
      group.items.length > 0 && (statusFilter === 'all' ? true : group.status === statusFilter),
  );

  /* Only the student's standing varies row to row; the admin and mentor views
     already list a single relation for the whole page. */
  const relationOf = (item: (typeof decorated)[number]): RelationKey | null => {
    if (!user || user.role !== 'student') return null;
    if (item.leader?._id && item.leader._id === user._id) return 'lead';
    if (item.members.some((member) => member._id === user._id)) return 'member';
    if (item.pending) return 'pending';
    return null;
  };

  const leaders = useMemo(() => {
    const seen = new Set<string>();
    return decorated
      .map(({ project, leader }) => ({ project, leader }))
      .filter(({ leader }) => {
        if (!leader?._id || seen.has(leader._id)) return false;
        seen.add(leader._id);
        return true;
      });
  }, [decorated]);

  const studentPeople = useMemo(() => {
    const seen = new Map<string, ProjectPerson>();
    Object.values(membersByProject).forEach((members) =>
      members.forEach((member) => {
        if (member._id && !seen.has(member._id)) seen.set(member._id, member);
      }),
    );
    return Array.from(seen.values());
  }, [membersByProject]);

  const uniqueStudents = studentPeople.length;

  /* The widest team on the board is the only ceiling the data actually gives us,
     so the bed is measured against it and says so in its accessible name. The
     size comes from the server's `memberCount`, so a capped roster cannot
     under-report a team. */
  const maxTeam = useMemo(
    () => Math.max(1, ...decorated.map((item) => item.project.memberCount ?? item.members.length)),
    [decorated],
  );

  // `myRelation` answers leading / on-a-team directly; only "with a leader" is a
  // count over the fetched page. A per-role summary block would fold all three.
  /* What the portfolio means to the person reading it: counts, never a sentence. */
  const gauges = useMemo(() => {
    if (!user || projects.length === 0) return [] as {
      key: string;
      label: string;
      value: number;
      total?: number;
      mark: ReactNode;
    }[];

    // `myRelation` is answered by the API, so these counts no longer depend on
    // whether the roster call happened to succeed.
    const leading = decorated.filter(
      (item) => item.project.myRelation === 'leading' || item.leader?._id === user._id,
    ).length;
    const onTeam = decorated.filter(
      (item) =>
        item.project.myRelation === 'member' ||
        item.members.some((member) => member._id === user._id),
    ).length;

    if (user.role === 'student') {
      return [
        { key: 'lead', label: 'Leading', value: leading, total: projects.length, mark: <LeadMark /> },
        {
          key: 'team',
          label: 'On a team',
          value: onTeam,
          total: projects.length,
          mark: <KindGlyph kind="member" size={16} />,
        },
        {
          key: 'req',
          label: 'Requesting',
          value: pendingProjectIds.length,
          mark: <KindGlyph kind="request" size={16} />,
        },
      ];
    }

    if (user.role === 'project_admin') {
      return [
        {
          key: 'admin',
          label: 'Administering',
          value: projects.length,
          total: projects.length,
          mark: <KindGlyph kind="project" size={16} />,
        },
        {
          key: 'led',
          label: 'With a leader',
          value: leaders.length,
          total: projects.length,
          mark: <LeadMark />,
        },
      ];
    }

    if (user.role === 'faculty_mentor') {
      return [
        {
          key: 'mentor',
          label: 'Mentoring',
          value: projects.length,
          total: projects.length,
          mark: <KindGlyph kind="mentor" size={16} />,
        },
        {
          key: 'led',
          label: 'With a leader',
          value: leaders.length,
          total: projects.length,
          mark: <LeadMark />,
        },
      ];
    }

    return [
      {
        key: 'led',
        label: 'With a leader',
        value: leaders.length,
        total: projects.length,
        mark: <LeadMark />,
      },
    ];
  }, [user, decorated, projects.length, leaders.length, pendingProjectIds.length]);

  const standingTitle = user?.role === 'student' ? 'Your standing' : 'Portfolio';

  const toggleGroup = (status: StatusKey) =>
    setOpenGroups((current) => ({ ...current, [status]: !current[status] }));

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  return (
    <div className="prj-page">
      <header className="ui-page-head prj-head prj-rise" style={{ '--i': 0 } as CSSProperties}>
        <div className="ui-page-head__text">
          <div className="prj-head__title">
            <h1 className="ui-title">Projects</h1>
            {!loading && (
              <span className="prj-head__count" aria-label={`${projects.length} projects`}>
                <Counter value={projects.length} />
              </span>
            )}
          </div>
        </div>

        <div className="ui-page-actions prj-head__actions">
          <div className="ui-search prj-search">
            <SearchMark />
            <input
              className="ui-field"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
            />
          </div>
          {user?.role === 'project_admin' && (
            <button
              ref={newProjectTrigger}
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={() => setShowForm(true)}
            >
              New project
            </button>
          )}
        </div>
      </header>

      {showForm && (
        <ProjectForm
          onSave={() => {
            closeForm();
            loadProjects();
          }}
          onCancel={closeForm}
        />
      )}

      {error && (
        <div className="ui-notice ui-notice--error prj-notice" role="alert">
          <span>{error}</span>
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={loadProjects}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="prj-loading" aria-hidden="true">
          <div className="prj-loading__board">
            <div className="prj-rail prj-rail--skeleton">
              {[0, 1, 2].map((cell) => (
                <span className="prj-rail__cell" key={cell}>
                  <span className="ui-skel" style={{ width: '58%', height: 10 }} />
                </span>
              ))}
            </div>
            <div className="prj-board__skeleton">
              {[0, 1, 2].map((row) => (
                <div className="prj-skel-row" key={row}>
                  <span className="ui-skel prj-skel-row__mark" />
                  <span className="ui-skel prj-skel-row__main" />
                  <span className="ui-skel prj-skel-row__person" />
                </div>
              ))}
            </div>
          </div>
          <aside className="prj-loading__aside">
            <div className="ui-panel">
              <div className="ui-panel__head">
                <span className="ui-skel" style={{ width: '42%', height: 12 }} />
              </div>
              <div className="ui-panel__body ui-stack">
                {[0, 1, 2].map((row) => (
                  <span className="ui-skel" key={row} style={{ width: '100%', height: 16 }} />
                ))}
                <span className="ui-skel" style={{ width: '55%', height: 10 }} />
              </div>
            </div>
          </aside>
        </div>
      ) : error && projects.length === 0 ? null : projects.length === 0 ? (
        <div className="ui-empty prj-empty">
          <span className="ui-empty__mark">
            <FolderMark />
          </span>
          <p className="ui-empty__title">No projects yet</p>
          <p className="ui-empty__text">
            {user?.role === 'project_admin'
              ? 'Create the first GUIITAR project to give a team a name and a board.'
              : 'Projects appear here once the council publishes them.'}
          </p>
          {user?.role === 'project_admin' && (
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setShowForm(true)}>
              New project
            </button>
          )}
        </div>
      ) : (
        <div className="prj-layout">
          <div className="prj-board">
            {/* The status rail: real counts → widths, and the board's filter. */}
            <div
              className="prj-rail prj-rise"
              role="group"
              aria-label="Projects by status"
              style={{ '--i': 1 } as CSSProperties}
            >
              {visibleStatuses.map((status) => {
                const count = statusCounts[status];
                const pressed = statusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    className={`prj-rail__cell is-${status}`}
                    style={{ flexGrow: count }}
                    aria-pressed={pressed}
                    title={`${STATUS_LABEL[status]} · ${STATUS_NOTE[status]}`}
                    onClick={() => setStatusFilter(pressed ? 'all' : status)}
                  >
                    <span className="prj-rail__head">
                      <span className={`prj-status-mark is-${status}`} aria-hidden="true" />
                      <span className="prj-rail__label">{STATUS_LABEL[status]}</span>
                      <span className="prj-rail__count">{count}</span>
                    </span>
                    <span className="prj-rail__scale" aria-hidden="true">
                      {Array.from({ length: count }, (_, i) => (
                        <span className="prj-rail__unit" key={i} />
                      ))}
                    </span>
                  </button>
                );
              })}
              {visibleStatuses.length > 1 && (
                <button
                  type="button"
                  className="prj-rail__all"
                  aria-pressed={statusFilter === 'all'}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                  <span className="prj-rail__count">{projects.length}</span>
                </button>
              )}
            </div>

            <p className="ui-visually-hidden" aria-live="polite">
              {searched.length} of {projects.length} projects
            </p>

            {groups.length === 0 ? (
              <div className="ui-empty prj-empty prj-empty--board">
                <span className="ui-empty__mark">
                  <FolderMark />
                </span>
                <p className="ui-empty__title">No projects match this view</p>
                <p className="ui-empty__text">
                  {query.trim() ? `Nothing matches “${query.trim()}”.` : 'This status has no projects.'}
                </p>
                <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="prj-groups">
                {groups.map((group, groupIndex) => {
                  const open = statusFilter !== 'all' || openGroups[group.status];
                  return (
                    <section
                      key={group.status}
                      className={`prj-group is-${group.status}`}
                      aria-labelledby={`prj-group-${group.status}`}
                      style={{ '--i': Math.min(7, groupIndex + 2) } as CSSProperties}
                    >
                      <header className="prj-group__head">
                        <span className={`prj-status-mark is-${group.status}`} aria-hidden="true" />
                        <h2 className="prj-group__title" id={`prj-group-${group.status}`}>
                          {STATUS_LABEL[group.status]}
                        </h2>
                        <span className="prj-group__count">{group.items.length}</span>
                        {statusFilter === 'all' && (
                          <button
                            type="button"
                            className="prj-group__toggle"
                            aria-expanded={open}
                            aria-controls={`prj-rows-${group.status}`}
                            aria-label={`${open ? 'Hide' : 'Show'} ${STATUS_LABEL[group.status].toLowerCase()} projects`}
                            onClick={() => toggleGroup(group.status)}
                          >
                            <ChevronMark />
                          </button>
                        )}
                      </header>

                      {open && (
                        <ul className="prj-rows" id={`prj-rows-${group.status}`}>
                          {group.items.map((item) => {
                            const { project, leader, members, status } = item;
                            const relation = relationOf(item);
                            const people = members.map((member) => ({
                              name: member.name || 'Unnamed student',
                              image: member.profileImage || undefined,
                            }));
                            const relationLabel =
                              relation === 'lead'
                                ? 'You lead this project'
                                : relation === 'member'
                                  ? 'You are on this team'
                                  : relation === 'pending'
                                    ? 'Your request is pending'
                                    : null;

                            const row = (
                              <Link className={`prj-row is-${status}`} to={`/projects/${project._id}`}>
                                <Plate project={project} status={status} />

                                {project.description ? (
                                  <Tooltip
                                    side="bottom"
                                    label={<span className="prj-tip__text">{project.description}</span>}
                                  >
                                    <span className="prj-row__main">
                                      <span className="prj-row__name">{project.name}</span>
                                      <span className="prj-row__line">{project.description}</span>
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <span className="prj-row__main">
                                    <span className="prj-row__name">{project.name}</span>
                                  </span>
                                )}

                                <span className="prj-row__marks">
                                  <span className="prj-team">
                                    {people.length ? (
                                      <AvatarStack people={people} max={4} size="sm" />
                                    ) : (
                                      <span
                                        className="prj-av-empty"
                                        role="img"
                                        aria-label="No team members yet"
                                      />
                                    )}
                                    <Tooltip
                                      label={`${members.length} ${
                                        members.length === 1 ? 'member' : 'members'
                                      } of ${maxTeam} — the largest team on the board`}
                                    >
                                      <span className="prj-team__bed">
                                        <Segments
                                          value={members.length}
                                          total={maxTeam}
                                          segments={Math.min(8, Math.max(3, maxTeam))}
                                          tone="ramp"
                                          ariaLabel={`${members.length} ${
                                            members.length === 1 ? 'member' : 'members'
                                          }; largest team on the board has ${maxTeam}`}
                                        />
                                      </span>
                                    </Tooltip>
                                  </span>

                                  <Tooltip
                                    label={
                                      leader?.name
                                        ? `Team leader · ${leader.name}`
                                        : 'No team leader assigned'
                                    }
                                  >
                                    <span className={`prj-lead${leader ? '' : ' is-empty'}`}>
                                      <span className="prj-lead__plate" aria-hidden="true">
                                        {leader?.profileImage ? (
                                          <img src={leader.profileImage} alt="" />
                                        ) : leader ? (
                                          initialOf(leader.name)
                                        ) : (
                                          '?'
                                        )}
                                      </span>
                                      <span className="prj-lead__glyph" aria-hidden="true">
                                        <LeadMark size={11} />
                                      </span>
                                      <span className="ui-visually-hidden">
                                        {leader?.name ? `Led by ${leader.name}` : 'No team leader assigned'}
                                      </span>
                                    </span>
                                  </Tooltip>

                                  {relation && relationLabel && (
                                    <span className={`prj-rel is-${relation}`}>
                                      <Tooltip label={relationLabel}>
                                        <span className="prj-rel__mark" role="img" aria-label={relationLabel}>
                                          {relation === 'lead' ? (
                                            <LeadMark size={14} />
                                          ) : relation === 'pending' ? (
                                            <PendingMark />
                                          ) : (
                                            <KindGlyph kind="member" size={16} />
                                          )}
                                        </span>
                                      </Tooltip>
                                    </span>
                                  )}
                                </span>

                                <span className="prj-row__open" aria-hidden="true">
                                  <span>Open</span>
                                  <ArrowMark />
                                </span>
                              </Link>
                            );

                            return (
                              <li key={project._id}>{row}</li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="prj-aside" aria-label="Portfolio summary">
            {gauges.length > 0 && (
              <section
                className="ui-panel prj-gauge-panel prj-rise"
                aria-labelledby="prj-standing-title"
                style={{ '--i': 2 } as CSSProperties}
              >
                <header className="ui-panel__head">
                  <div className="ui-panel__titles">
                    <h2 className="ui-panel__title" id="prj-standing-title">
                      {standingTitle}
                    </h2>
                    <span className="ui-panel__meta">
                      <Counter value={projects.length} />
                    </span>
                  </div>
                </header>
                <div className="ui-panel__body">
                  <ul className="prj-gauge">
                    {gauges.map((row) => (
                      <li className="prj-gauge__row" key={row.key}>
                        <span className={`prj-gauge__mark is-${row.key}`} aria-hidden="true">
                          {row.mark}
                        </span>
                        <span className="prj-gauge__label">{row.label}</span>
                        {typeof row.total === 'number' ? (
                          <Tooltip
                            label={`${row.label}: ${row.value} of ${row.total} projects`}
                          >
                            <span className="prj-gauge__scale">
                              <Segments
                                value={row.value}
                                total={row.total}
                                segments={Math.min(8, Math.max(3, row.total))}
                                tone={row.key === 'lead' ? 'accent' : 'ramp'}
                                ariaLabel={`${row.label}: ${row.value} of ${row.total}`}
                              />
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="prj-gauge__scale prj-gauge__scale--empty" aria-hidden="true" />
                        )}
                        <span className="prj-gauge__num">
                          <Counter value={row.value} />
                        </span>
                      </li>
                    ))}
                  </ul>

                  {uniqueStudents > 0 && (
                    <div className="prj-gauge__foot">
                      <AvatarStack
                        people={studentPeople.map((person) => ({
                          name: person.name || 'Unnamed student',
                          image: person.profileImage || undefined,
                        }))}
                        max={5}
                        size="sm"
                      />
                      <span className="prj-gauge__foot-num">
                        <Counter value={uniqueStudents} />
                      </span>
                      <span className="prj-gauge__foot-label">on teams</span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </aside>

          {leaders.length > 0 && (
            <section
              className="ui-panel prj-leaders-panel prj-rise"
              aria-labelledby="prj-leaders-title"
              style={{ '--i': 3 } as CSSProperties}
            >
              <header className="ui-panel__head">
                <div className="ui-panel__titles">
                  <h2 className="ui-panel__title" id="prj-leaders-title">
                    Team leaders
                  </h2>
                  <span className="ui-panel__meta">
                    <Counter value={leaders.length} />
                  </span>
                </div>
              </header>
              <div className="ui-panel__body ui-panel__body--flush">
                <ul className="prj-leaders">
                  {leaders.map(({ project, leader }) => (
                    <li key={project._id}>
                      <Link className="prj-leader" to={`/projects/${project._id}`}>
                        <span className="prj-lead__plate" aria-hidden="true">
                          {leader?.profileImage ? (
                            <img src={leader.profileImage} alt="" />
                          ) : (
                            initialOf(leader?.name)
                          )}
                        </span>
                        <span className="prj-leader__text">
                          <span className="prj-leader__name">{leader?.name || 'Not assigned'}</span>
                          <span className="prj-leader__project">{project.name}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
