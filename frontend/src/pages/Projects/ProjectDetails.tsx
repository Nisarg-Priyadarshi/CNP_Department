import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectMentors } from '../../components/projects/ProjectMentors';
import { ProjectMaterials } from '../../components/projects/ProjectMaterials';
import { ProjectMaterialRequests } from '../../components/projects/ProjectMaterialRequests';
import { ProjectUpdates } from '../../components/projects/ProjectUpdates';
import { ProjectManagement } from '../../components/projects/ProjectManagement';
import { ProjectJoinRequests } from '../../components/projects/ProjectJoinRequests';
import { usePageLoading } from '../../context/LoadingContext';
import { AvatarStack, Counter, KindGlyph, Ring } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import './projects.css';

interface ProjectPerson {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  semester?: number | null;
  profileImage?: string | null;
}

interface ProjectMember {
  _id: string;
  studentId?: ProjectPerson;
  joinedAt?: string;
}

interface MentorAssignment {
  _id?: string;
  assignmentId?: string;
  isPrimary?: boolean;
  mentorId?: ProjectPerson;
}

interface ProjectRecord {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  image?: string | null;
  teamLeaderId?: ProjectPerson | string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface MaterialSummary {
  total: number;
  guitar: number;
  purchased: number;
  owned: number;
}

interface RequestStats {
  total: number;
  approved: number;
  pending: number;
}

function initialOf(name?: string): string {
  return (name || '?').replace(/^Dr\.\s*/i, '').trim().charAt(0).toUpperCase() || '?';
}

function monogram(name?: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function fullDate(value?: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusText(status?: string): string {
  if (!status) return 'Active';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusKey(status?: string): 'active' | 'completed' | 'inactive' {
  return status === 'completed' || status === 'inactive' ? status : 'active';
}

const STATUS_TONE: Record<'active' | 'completed' | 'inactive', string> = {
  active: 'is-positive',
  completed: 'ui-tag--plain',
  inactive: 'is-warning',
};

const STATUS_NOTE: Record<'active' | 'completed' | 'inactive', string> = {
  active: 'Work in progress',
  completed: 'Delivered and closed',
  inactive: 'Paused for now',
};

const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CameraMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 8.5h3l1.4-2h6.2l1.4 2H20v9H4v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="12" cy="12.6" r="2.6" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const LockMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="10" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const LayersMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m12 4 8 4-8 4-8-4 8-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="m4 12 8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const LeadMark = () => (
  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
    <path
      d="M2.6 8.3 2 3.3l2.4 1.8L6 2.6l1.6 2.5L10 3.3l-.6 5Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M2.6 10.2h6.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function PersonAvatar({ person, size = 'sm' }: { person?: ProjectPerson | null; size?: 'sm' | 'md' | 'lg' }) {
  const className =
    size === 'lg'
      ? 'ui-avatar ui-avatar--lg prj-avatar'
      : size === 'md'
        ? 'ui-avatar prj-avatar'
        : 'ui-avatar ui-avatar--sm prj-avatar';
  if (person?.profileImage) {
    return (
      <span className={className}>
        <img src={person.profileImage} alt="" />
      </span>
    );
  }
  return (
    <span className={className} aria-hidden="true">
      {initialOf(person?.name)}
    </span>
  );
}

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [mentors, setMentors] = useState<MentorAssignment[]>([]);
  const [joinStatus, setJoinStatus] = useState<string>('none');
  const [pendingRequests, setPendingRequests] = useState<number | null>(null);
  const [materials, setMaterials] = useState<MaterialSummary | null>(null);
  const [requests, setRequests] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = async () => {
    setPageLoading(true);
    try {
      setError(null);
      const res = await api<any>('GET', `/projects/${id}`);
      if (!res.data) throw new Error('Project not found');
      setProject(res.data);

      const [mems, ments] = await Promise.all([
        api<any>('GET', `/projects/${id}/members`).then((r) => r.data).catch(() => []),
        api<any>('GET', `/projects/${id}/mentors`).then((r) => r.data).catch(() => []),
      ]);
      setMembers(mems || []);
      setMentors(ments || []);

      if (user?.role === 'student') {
        const reqs = await api<any>('GET', '/join-requests/student').then((r) => r.data).catch(() => []);
        const tlId = typeof res.data.teamLeaderId === 'object' ? res.data.teamLeaderId?._id : res.data.teamLeaderId;
        const isTL = tlId && user?._id && tlId === user._id;
        // `myRelation` is the API's own answer (leading | member | mentor | none),
        // so the page no longer re-derives it from the roster.
        const relation = res.data.myRelation;
        const isMember =
          relation === 'leading' ||
          relation === 'member' ||
          isTL ||
          (mems || []).some((m: any) => {
            const sId = typeof m.studentId === 'object' ? m.studentId?._id : m.studentId;
            return sId && user?._id && sId === user._id;
          });
        const hasPending = (reqs || []).some(
          (r: any) => (r.projectId?._id || r.projectId) === id && r.status === 'pending',
        );
        if (isMember) setJoinStatus('member');
        else if (hasPending) setJoinStatus('pending');
        else setJoinStatus('none');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load project details');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, user?._id]);

  useEffect(() => {
    if (!loading && window.location.hash) {
      setTimeout(() => {
        const el = document.querySelector(window.location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [loading]);

  const handleJoin = async () => {
    try {
      await api('POST', `/projects/${id}/join`);
      setJoinStatus('pending');
      alert('Join request sent successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to join');
    }
  };

  /* The Team Leader cannot leave their own project — the API answers 409 — so the
     action is only offered to ordinary members. */
  const handleLeave = async () => {
    try {
      setLeaving(true);
      await api('DELETE', `/projects/${id}/join`);
      setJoinStatus('none');
      setConfirmLeave(false);
      await load();
    } catch (e: any) {
      alert(e.message || 'Could not leave the project');
    } finally {
      setLeaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setLoading(true);
      await api('POST', `/projects/${id}/image`, formData);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to upload project image');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="prj-page prj-detail">
        <div className="prj-detail-loading" aria-hidden="true">
          <span className="ui-skel" style={{ width: '8rem', height: 12 }} />
          <div className="prj-identity prj-identity--skeleton">
            <span className="ui-skel prj-identity__mark-skel" />
            <div className="prj-identity__main">
              <span className="ui-skel" style={{ width: '45%', height: 26 }} />
              <span className="ui-skel" style={{ width: '75%', height: 12, marginTop: 12 }} />
              <span className="ui-skel" style={{ width: '55%', height: 34, marginTop: 18 }} />
            </div>
          </div>
          <div className="prj-detail-grid">
            <div className="prj-main">
              {[0, 1].map((panel) => (
                <div className="ui-panel" key={panel}>
                  <div className="ui-panel__head">
                    <span className="ui-skel" style={{ width: '30%', height: 13 }} />
                  </div>
                  <div className="ui-panel__body ui-stack">
                    <span className="ui-skel" style={{ width: '100%', height: 44 }} />
                    <span className="ui-skel" style={{ width: '92%', height: 44 }} />
                  </div>
                </div>
              ))}
            </div>
            <aside className="prj-aside">
              <div className="ui-panel">
                <div className="ui-panel__head">
                  <span className="ui-skel" style={{ width: '50%', height: 13 }} />
                </div>
                <div className="ui-panel__body ui-stack">
                  {[0, 1, 2, 3].map((row) => (
                    <span className="ui-skel" key={row} style={{ width: '100%', height: 32 }} />
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prj-page prj-detail">
        <nav className="prj-crumb" aria-label="Breadcrumb">
          <Link className="prj-back" to="/projects">
            <ArrowLeft />
            Projects
          </Link>
        </nav>
        <div className="ui-notice ui-notice--error prj-detail-error" role="alert">
          <div className="ui-stack ui-stack--sm">
            <strong>This project could not be loaded</strong>
            <span>{error}</span>
          </div>
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={load}>
            Retry
          </button>
        </div>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => navigate('/projects')}>
          Back to projects
        </button>
      </div>
    );
  }

  if (!project) return null;

  const isTL = (m: ProjectMember) => {
    const tlId = typeof project.teamLeaderId === 'object' ? project.teamLeaderId?._id : project.teamLeaderId;
    const sId = typeof m.studentId === 'object' ? m.studentId?._id : m.studentId;
    return Boolean(tlId && sId && tlId === sId);
  };

  const projectTLId = typeof project.teamLeaderId === 'object' ? project.teamLeaderId?._id : project.teamLeaderId;
  const currentUserIsTL = Boolean(projectTLId && user?._id && projectTLId === user._id);
  const teamLeader = typeof project.teamLeaderId === 'object' ? project.teamLeaderId : null;

  const isMember =
    (members || []).some((m: any) => {
      const sId = typeof m.studentId === 'object' ? m.studentId?._id : m.studentId;
      return sId && user?._id && sId === user._id;
    }) || currentUserIsTL;

  const isAssignedMentor =
    user?.role === 'faculty_mentor' &&
    (mentors || []).some((m: any) => {
      const mId = typeof m.mentorId === 'object' ? m.mentorId?._id : m.mentorId;
      return mId && user?._id && mId === user._id;
    });

  const isProjectAdmin = user?.role === 'project_admin';
  const canAccessProjectContent = isProjectAdmin || isAssignedMentor || isMember;

  const relation = isProjectAdmin
    ? 'Project admin'
    : isAssignedMentor
      ? 'Mentor'
      : currentUserIsTL
        ? 'Team leader'
        : isMember
          ? 'Team member'
          : user?.role === 'student'
            ? joinStatus === 'pending'
              ? 'Request pending'
              : 'Not a member'
            : null;

  const relationKey = isProjectAdmin
    ? 'admin'
    : currentUserIsTL
      ? 'lead'
      : isMember
        ? 'member'
        : isAssignedMentor
          ? 'mentor'
          : 'none';

  const sortedMembers = [...(members || [])].sort((a, b) => {
    if (isTL(a)) return -1;
    if (isTL(b)) return 1;
    return (a.studentId?.name || '').localeCompare(b.studentId?.name || '');
  });

  const memberPeople = sortedMembers
    .map((member) => member.studentId)
    .filter((person): person is ProjectPerson => Boolean(person));

  const mentorPeople = (mentors || [])
    .map((assignment) => assignment.mentorId)
    .filter((person): person is ProjectPerson => Boolean(person));

  const status = statusKey(project.status);
  // MOCK: coverage is approved material requests over all requests, counted from
  // the rows ProjectMaterialRequests already fetched. Suggested API: an approval
  // summary on GET /projects/:id.
  const requestsTotal = requests?.total ?? 0;
  const requestsApproved = requests?.approved ?? 0;
  const coverRatio = requestsTotal > 0 ? requestsApproved / requestsTotal : 0;

  const showFacts = memberPeople.length > 0 || mentorPeople.length > 0 || Boolean(relation);
  const showCoveragePanel = canAccessProjectContent && (materials !== null || requests !== null);

  return (
    <div className="prj-page prj-detail">
      <nav className="prj-crumb">
        <Link className="prj-back" to="/projects">
          <ArrowLeft />
          Projects
        </Link>
        <span className="prj-crumb__divider" aria-hidden="true">
          /
        </span>
        <span className="prj-crumb__here">{project.name}</span>
      </nav>

      {/* ── Identity plate ───────────────────────────────────────────────── */}
      <header className="prj-identity prj-rise" style={{ '--i': 0 } as CSSProperties}>
        <div className="prj-identity__mark-wrap">
          <span className={`prj-identity__mark is-${status}`}>
            {project.image ? (
              <img src={project.image} alt="" />
            ) : (
              <span aria-hidden="true">{monogram(project.name)}</span>
            )}
          </span>
          {isProjectAdmin && (
            <label className="prj-identity__image-btn" title="Change project image">
              <CameraMark />
              <span className="ui-visually-hidden">Change project image</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
            </label>
          )}
        </div>

        <div className="prj-identity__main">
          <div className="prj-identity__title-row">
            <h1 className="prj-detail-title">{project.name}</h1>
            <span
              className={`ui-tag ${STATUS_TONE[status]}`}
              title={`${statusText(project.status)} · ${STATUS_NOTE[status]}`}
            >
              {statusText(project.status)}
            </span>
          </div>

          {project.description && (
            <p className="prj-identity__desc" title={project.description}>
              {project.description}
            </p>
          )}

          <div className="prj-identity__facts">
            <span className={`prj-idfact${teamLeader ? '' : ' is-empty'}`}>
              {teamLeader ? (
                <>
                  <span className="prj-lead">
                    <span className="prj-lead__plate" aria-hidden="true">
                      {teamLeader.profileImage ? (
                        <img src={teamLeader.profileImage} alt="" />
                      ) : (
                        initialOf(teamLeader.name)
                      )}
                    </span>
                    <span className="prj-lead__glyph" aria-hidden="true">
                      <LeadMark />
                    </span>
                  </span>
                  <span className="prj-idfact__text">
                    <span className="prj-idfact__name">{teamLeader.name}</span>
                    <span className="prj-idfact__label">Team leader</span>
                  </span>
                </>
              ) : (
                <Tooltip label="No team leader assigned">
                  <span className="prj-idfact__text">
                    <span className="prj-idfact__name is-muted">Lead open</span>
                    <span className="prj-idfact__label">Team leader</span>
                  </span>
                </Tooltip>
              )}
            </span>

            <span className="prj-idfact">
              {memberPeople.length ? (
                <AvatarStack
                  people={memberPeople.map((person) => ({
                    name: person.name || 'Unnamed student',
                    image: person.profileImage || undefined,
                  }))}
                  max={3}
                  size="sm"
                />
              ) : (
                <span className="prj-av-empty" aria-hidden="true" />
              )}
              <span className="prj-idfact__text">
                <span className="prj-idfact__name">
                  <Counter value={members.length} />
                </span>
                <span className="prj-idfact__label">
                  {members.length === 1 ? 'Member' : 'Members'}
                </span>
              </span>
            </span>

            <span className={`prj-idfact${mentorPeople.length ? '' : ' is-empty'}`}>
              {mentorPeople.length ? (
                <>
                  <AvatarStack
                    people={mentorPeople.map((person) => ({
                      name: person.name || 'Mentor',
                      image: person.profileImage || undefined,
                    }))}
                    max={3}
                    size="sm"
                  />
                  <span className="prj-idfact__text">
                    <span className="prj-idfact__name">
                      <Counter value={mentorPeople.length} />
                    </span>
                    <span className="prj-idfact__label">
                      {mentorPeople.length === 1 ? 'Mentor' : 'Mentors'}
                    </span>
                  </span>
                </>
              ) : (
                <Tooltip label="No faculty mentor assigned">
                  <span className="prj-idfact__text">
                    <span className="prj-idfact__name is-muted">Mentor open</span>
                    <span className="prj-idfact__label">Faculty</span>
                  </span>
                </Tooltip>
              )}
            </span>
          </div>
        </div>

        <div className="prj-identity__actions">
          {relation && !(user?.role === 'student' && joinStatus === 'pending') && (
            <span className={`prj-rel-chip is-${relationKey}`}>
              {relationKey === 'lead' ? (
                <LeadMark />
              ) : relationKey === 'member' ? (
                <KindGlyph kind="member" size={14} />
              ) : relationKey === 'mentor' ? (
                <KindGlyph kind="mentor" size={14} />
              ) : relationKey === 'admin' ? (
                <KindGlyph kind="project" size={14} />
              ) : null}
              {relation}
            </span>
          )}
          {user?.role === 'student' &&
            (joinStatus === 'pending' ? (
              <span className="ui-tag is-warning">Request pending</span>
            ) : joinStatus === 'none' ? (
              <button type="button" className="ui-btn ui-btn--primary" onClick={handleJoin}>
                Join project
              </button>
            ) : null)}
          {user?.role === 'student' && joinStatus === 'member' && !currentUserIsTL ? (
            confirmLeave ? (
              <span className="prj-leave" role="group" aria-label="Confirm leaving this project">
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
                title="Leave this project; you can request to join again"
              >
                Leave project
              </button>
            )
          ) : null}
          {isProjectAdmin && (
            <a className="ui-btn ui-btn--quiet prj-identity__manage" href="#manage" title="Project settings">
              Manage
            </a>
          )}
        </div>
      </header>

      {/* ── The record ───────────────────────────────────────────────────── */}
      <div className="prj-detail-grid">
        <div className="prj-main">
          {isProjectAdmin || user?.role === 'faculty_mentor' ? (
            <ProjectJoinRequests
              projectId={project._id}
              onUpdate={load}
              onCountChange={setPendingRequests}
            />
          ) : null}

          {canAccessProjectContent ? (
            <ProjectUpdates
              projectId={project._id}
              projectName={project.name}
              isTL={currentUserIsTL}
              mentors={mentors}
            />
          ) : (
            <section className="ui-panel prj-restricted" aria-labelledby="prj-restricted-title">
              <div className="ui-panel__body">
                <span className="ui-empty__mark">
                  <LockMark />
                </span>
                <h2 className="ui-h3" id="prj-restricted-title">
                  Project work is restricted
                </h2>
                <p className="prj-restricted__text">
                  {user?.role === 'student'
                    ? joinStatus === 'pending'
                      ? 'Updates and materials open when the team accepts your request.'
                      : 'Send a join request to open updates, materials and requests.'
                    : 'Open to the team, its mentors and project admins.'}
                </p>
              </div>
            </section>
          )}

          <section className="ui-panel prj-team-panel" aria-labelledby="prj-team-title">
            <header className="ui-panel__head">
              <div className="ui-panel__titles">
                <h2 className="ui-panel__title" id="prj-team-title">
                  Team
                </h2>
                <span className="ui-panel__meta">
                  <Counter value={members.length} />
                </span>
              </div>
              {memberPeople.length > 0 && (
                <AvatarStack
                  people={memberPeople.map((person) => ({
                    name: person.name || 'Unnamed student',
                    image: person.profileImage || undefined,
                  }))}
                  max={5}
                  size="sm"
                  className="prj-team-panel__stack"
                />
              )}
            </header>
            <div className="ui-panel__body ui-panel__body--flush">
              {members.length ? (
                <ul className="prj-roster">
                  {sortedMembers.map((member) => (
                    <li key={member._id} className="ui-row prj-roster__row">
                      <PersonAvatar person={member.studentId} size="md" />
                      <div className="prj-roster__main">
                        <p className="prj-roster__name">{member.studentId?.name || 'Unknown student'}</p>
                        <p className="prj-roster__sub">
                          {[member.studentId?.department, member.studentId?.semester ? `Semester ${member.studentId.semester}` : null]
                            .filter(Boolean)
                            .join(' · ') || 'Student'}
                        </p>
                      </div>
                      {isTL(member) ? (
                        <span className="prj-lead-badge" title="Team leader">
                          <LeadMark />
                          <span>Lead</span>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ui-empty prj-empty prj-empty--inset">
                  <span className="ui-empty__mark">
                    <LayersMark />
                  </span>
                  <p className="ui-empty__title">No members yet</p>
                  <p className="ui-empty__text">Members appear here once they join.</p>
                </div>
              )}
            </div>
          </section>

          {canAccessProjectContent && (
            <>
              <ProjectMaterials projectId={project._id} isTL={currentUserIsTL} onSummaryChange={setMaterials} />
              <ProjectMaterialRequests
                projectId={project._id}
                isTL={currentUserIsTL}
                onStatsChange={setRequests}
              />
            </>
          )}

          <ProjectMentors
            projectId={project._id}
            mentors={mentors}
            onMentorsChange={(updatedMentors) => setMentors(updatedMentors)}
          />

          {isProjectAdmin && <ProjectManagement project={project} onUpdate={load} />}
        </div>

        <aside className="prj-aside prj-detail__aside" aria-label="Project facts">
          {showFacts && (
            <section className="ui-panel prj-facts-panel prj-rise" style={{ '--i': 1 } as CSSProperties}>
              <header className="ui-panel__head">
                <div className="ui-panel__titles">
                  <h2 className="ui-panel__title">Facts</h2>
                </div>
              </header>
              <div className="ui-panel__body">
                <dl className="prj-facts">
                  {memberPeople.length > 0 && (
                    <div>
                      <dt>
                        <KindGlyph kind="member" size={15} />
                        Team
                      </dt>
                      <dd>
                        <span className="prj-facts__inline">
                          <AvatarStack
                            people={memberPeople.map((person) => ({
                              name: person.name || 'Unnamed student',
                              image: person.profileImage || undefined,
                            }))}
                            max={4}
                            size="sm"
                          />
                          <Counter value={memberPeople.length} />
                        </span>
                      </dd>
                    </div>
                  )}
                  {mentorPeople.length > 0 && (
                    <div>
                      <dt>
                        <KindGlyph kind="mentor" size={15} />
                        Mentors
                      </dt>
                      <dd>
                        <span className="prj-facts__inline">
                          <AvatarStack
                            people={mentorPeople.map((person) => ({
                              name: person.name || 'Mentor',
                              image: person.profileImage || undefined,
                            }))}
                            max={3}
                            size="sm"
                          />
                          <Counter value={mentorPeople.length} />
                        </span>
                      </dd>
                    </div>
                  )}
                  {(isProjectAdmin || isAssignedMentor) && (
                    <div>
                      <dt>
                        <KindGlyph kind="request" size={15} />
                        Join requests
                      </dt>
                      <dd>
                        {pendingRequests === null ? '—' : <Counter value={pendingRequests} />}
                      </dd>
                    </div>
                  )}
                  {relation && (
                    <div>
                      <dt>
                        <KindGlyph kind="project" size={15} />
                        Your access
                      </dt>
                      <dd className="prj-facts__relation">{relation}</dd>
                    </div>
                  )}
                </dl>
              </div>
              {isProjectAdmin && (
                <footer className="ui-panel__foot prj-facts__foot">
                  <a className="ui-link" href="#manage">
                    Edit project settings
                  </a>
                </footer>
              )}
            </section>
          )}

          {showCoveragePanel && (
            <section
              className="ui-panel prj-cover prj-rise"
              aria-labelledby="prj-cover-title"
              style={{ '--i': 2 } as CSSProperties}
            >
              <header className="ui-panel__head">
                <div className="ui-panel__titles">
                  <h2 className="ui-panel__title" id="prj-cover-title">
                    Materials
                  </h2>
                  <span className="ui-panel__meta">
                    <Counter value={materials?.total ?? 0} />
                  </span>
                </div>
              </header>
              <div className="ui-panel__body">
                <div className="prj-cover__row">
                  <Tooltip
                    label={
                      requestsTotal > 0
                        ? `${requestsApproved} of ${requestsTotal} material requests approved`
                        : 'No material requests yet'
                    }
                  >
                    <span className="prj-cover__ring">
                      <Ring
                        value={coverRatio}
                        size={58}
                        tone="ink"
                        label={`${requestsApproved}/${requestsTotal}`}
                      />
                    </span>
                  </Tooltip>
                  <div className="prj-cover__nums">
                    <span className="prj-cover__num">
                      <Counter value={materials?.total ?? 0} />
                      <span className="prj-cover__num-label">items</span>
                    </span>
                    <span className="prj-cover__num">
                      <Counter value={requestsApproved} />
                      <span className="prj-cover__num-label">approved</span>
                    </span>
                    <span className="prj-cover__num">
                      <Counter value={requestsTotal} />
                      <span className="prj-cover__num-label">requests</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section
            className="ui-panel prj-record prj-rise"
            aria-labelledby="prj-record-title"
            style={{ '--i': 3 } as CSSProperties}
          >
            <header className="ui-panel__head">
              <div className="ui-panel__titles">
                <h2 className="ui-panel__title" id="prj-record-title">
                  Record
                </h2>
              </div>
            </header>
            <div className="ui-panel__body">
              <ol className="prj-spine">
                <li className="prj-spine__row">
                  <span className="prj-spine__rail" aria-hidden="true">
                    <span className="prj-spine__node" />
                  </span>
                  <span className="prj-spine__text">
                    <span className="prj-spine__label">Created</span>
                    <time className="prj-spine__date" dateTime={project.createdAt}>
                      {fullDate(project.createdAt)}
                    </time>
                  </span>
                </li>
                <li className="prj-spine__row">
                  <span className="prj-spine__rail" aria-hidden="true">
                    <span className="prj-spine__node is-latest" />
                  </span>
                  <span className="prj-spine__text">
                    <span className="prj-spine__label">Updated</span>
                    <time className="prj-spine__date" dateTime={project.updatedAt}>
                      {fullDate(project.updatedAt)}
                    </time>
                  </span>
                </li>
              </ol>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
