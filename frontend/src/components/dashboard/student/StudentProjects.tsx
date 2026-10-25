import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { KindGlyph } from '../../ui/vis';
import { Tooltip } from '../../ui/Tooltip';
import { DashboardSection, PanelError } from './DashboardSection';
import { LeadIcon, MentorIcon, PendingIcon } from './StudentIcons';
import { projectStage, projectStatus, refId, refName } from './studentUtils';
import type { StudentProjectWithMentors } from '../../../types/studentDashboard';

interface StudentProjectsProps {
  projects: StudentProjectWithMentors[];
  currentUserId: string;
  /** Project ids with a join request still awaiting a decision. */
  pendingProjectIds?: Set<string>;
  error?: string;
  /** How many of these teams you lead — derived on the page. */
  leadCount?: number;
}

function mentorName(project: StudentProjectWithMentors): string | null {
  if (!project.mentors.length) return null;
  const primary = project.mentors.find((assignment) => assignment.isPrimary) ?? project.mentors[0];
  return refName(primary?.mentorId);
}

/**
 * A project is a rail: a status position on three stages, your role as a mark,
 * the mentor and team lead one hover away. The stage is the status word placed
 * on a fixed track — never a fabricated percentage.
 */
export function StudentProjects({
  projects,
  currentUserId,
  pendingProjectIds,
  error,
  leadCount = 0,
}: StudentProjectsProps) {
  return (
    <DashboardSection
      id="sd-projects"
      title="Projects"
      meta={
        projects.length > 0 ? (
          <>
            {projects.length}
            {leadCount > 0 ? <span className="sd-region__note"> · {leadCount} lead</span> : null}
          </>
        ) : undefined
      }
      actionLabel="All projects"
      actionTo="/projects"
      className="sd-projects"
    >
      {error ? <PanelError message={error} /> : null}

      {projects.length > 0 ? (
        <ul className="sd-rails">
          {projects.map((project) => {
            const status = projectStatus(project.status);
            const stage = projectStage(project.status);
            const leads = refId(project.teamLeaderId) === currentUserId;
            const leader = refName(project.teamLeaderId);
            const mentor = mentorName(project);
            const pending = pendingProjectIds?.has(project._id) ?? false;

            const label = [
              project.name,
              status ? status.label : 'status unset',
              stage > 0 ? `stage ${stage} of 3` : null,
              leads ? 'you are team lead' : 'you are a member',
              !leads && leader ? `team lead ${leader}` : null,
              mentor ? `mentor ${mentor}` : null,
              pending ? 'join request pending' : null,
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <li key={project._id}>
                <Link className="sd-rail" to={`/projects/${project._id}`} aria-label={label}>
                  <span className="sd-rail__name">{project.name}</span>

                  <span className="sd-rail__flags" aria-hidden="true">
                    {leads ? (
                      <Tooltip label="Team lead — you">
                        <span className="sd-rail__flag is-lead">
                          <LeadIcon className="sd-icon sd-icon--xs" />
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip label="You · member">
                        <span className="sd-rail__flag is-member">
                          <KindGlyph kind="member" size={15} />
                        </span>
                      </Tooltip>
                    )}

                    {!leads && leader ? (
                      <Tooltip label={`Team lead · ${leader}`}>
                        <span className="sd-rail__flag is-lead-quiet">
                          <LeadIcon className="sd-icon sd-icon--xs" />
                        </span>
                      </Tooltip>
                    ) : null}

                    {mentor ? (
                      /* The name slides out on row hover; the link's accessible
                         name carries it for keyboard and screen readers. */
                      <span className="sd-rail__flag is-mentor">
                        <MentorIcon className="sd-icon sd-icon--xs" />
                        <span className="sd-rail__inspect">{mentor}</span>
                      </span>
                    ) : null}

                    {pending ? (
                      <Tooltip label="Join request pending">
                        <span className="sd-rail__flag is-warn">
                          <PendingIcon className="sd-icon sd-icon--xs" />
                        </span>
                      </Tooltip>
                    ) : null}
                  </span>

                  <span className="sd-rail__foot">
                    <span
                      className="sd-steps"
                      data-stage={stage || undefined}
                      aria-hidden="true"
                    >
                      {[1, 2, 3].map((step) => (
                        <Fragment key={step}>
                          {step > 1 ? (
                            <span className="sd-steps__link" data-on={step - 1 < stage || undefined} />
                          ) : null}
                          <span
                            className="sd-steps__node"
                            data-on={step <= stage || undefined}
                            data-current={step === stage || undefined}
                          />
                        </Fragment>
                      ))}
                    </span>

                    <span className="sd-rail__status">
                      {status ? status.label : 'No status'}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : !error ? (
        <div className="sd-region__state">
          <p className="sd-region__empty">No projects yet.</p>
          <Link className="ui-btn ui-btn--quiet ui-btn--sm" to="/projects">
            Browse projects
          </Link>
        </div>
      ) : null}
    </DashboardSection>
  );
}
