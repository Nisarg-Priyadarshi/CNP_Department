import { useState } from 'react';

interface ProjectMentorInfo {
  _id?: string;
  isPrimary?: boolean;
  mentorId?: {
    _id?: string;
    name?: string;
    department?: string;
    profileImage?: string | null;
  } | null;
}

interface StudentProjectCardProps {
  project: {
    _id: string;
    name: string;
    description?: string;
    image?: string | null;
    status?: string;
    teamLeaderId?: string | { _id?: string } | null;
    mentors?: ProjectMentorInfo[];
  };
  currentUserId?: string;
  onClick: () => void;
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

/**
 * A project on a dashboard surface: monogram, name, your standing, one line of
 * description and the mentor who reviews it. The whole tile opens the project.
 */
export function StudentProjectCard({ project, currentUserId, onClick }: StudentProjectCardProps) {
  const [imageError, setImageError] = useState(false);

  // Determine Team Leader status strictly from current project's teamLeaderId
  const tlId =
    typeof project.teamLeaderId === 'object' && project.teamLeaderId !== null
      ? project.teamLeaderId._id
      : project.teamLeaderId;

  const isTeamLeader = Boolean(currentUserId && tlId && String(tlId) === String(currentUserId));
  const positionText = isTeamLeader ? 'Team leader' : 'Team member';

  const mentors = project.mentors || [];
  const primaryMentor = mentors.find((m) => m.isPrimary) || mentors[0];
  const mentor = primaryMentor?.mentorId || null;

  return (
    <div
      className="prj-scard"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="prj-scard__head">
        {project.image && !imageError ? (
          <span className="prj-scard__mark">
            <img src={project.image} alt="" onError={() => setImageError(true)} />
          </span>
        ) : (
          <span className="prj-scard__mark" aria-hidden="true">
            {monogram(project.name)}
          </span>
        )}

        <div className="prj-scard__titles">
          <h3 className="prj-scard__title" title={project.name}>
            {project.name}
          </h3>
          <div className="prj-scard__tags">
            <span className={`ui-tag ui-tag--plain prj-scard__standing${isTeamLeader ? ' is-lead' : ''}`}>
              {positionText}
            </span>
            {project.status && (
              <span className={`ui-tag ${project.status === 'active' ? 'is-positive' : 'ui-tag--plain'}`}>
                {project.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="prj-scard__desc">{project.description || 'No description provided.'}</p>

      <div className="prj-scard__foot">
        <span className="prj-scard__foot-label">
          {mentors.length > 1 ? 'Faculty mentors' : 'Faculty mentor'}
        </span>
        {mentor ? (
          <span className="prj-scard__mentor">
            {mentor.profileImage ? (
              <span className="ui-avatar ui-avatar--sm prj-avatar">
                <img src={mentor.profileImage} alt="" />
              </span>
            ) : (
              <span className="ui-avatar ui-avatar--sm prj-avatar" aria-hidden="true">
                {initialOf(mentor.name)}
              </span>
            )}
            <span className="prj-scard__mentor-text">
              <span className="prj-scard__mentor-name">{mentor.name}</span>
              <span className="prj-scard__mentor-sub">
                {mentors.length > 1
                  ? `${mentor.department || 'Faculty'} · ${mentors.length} mentors`
                  : mentor.department || 'Faculty mentor'}
              </span>
            </span>
          </span>
        ) : (
          <span className="prj-scard__mentor">
            <span className="ui-avatar ui-avatar--sm prj-avatar is-empty" aria-hidden="true">
              ?
            </span>
            <span className="prj-scard__mentor-text">
              <span className="prj-scard__mentor-name is-muted">Not assigned</span>
              <span className="prj-scard__mentor-sub">Faculty mentor</span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
