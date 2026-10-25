import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { UserSelect } from '../UserSelect';
import { Counter } from '../ui/vis';

interface ProjectMentorsProps {
  projectId: string;
  mentors?: any[];
  onMentorsChange?: (mentors: any[]) => void;
}

function initialOf(name?: string): string {
  return (name || '?').replace(/^Dr\.\s*/i, '').trim().charAt(0).toUpperCase() || '?';
}

export function ProjectMentors({ projectId, mentors: propMentors, onMentorsChange }: ProjectMentorsProps) {
  const { user } = useAuth();
  const [mentors, setMentors] = useState<any[]>(propMentors || []);
  const [loading, setLoading] = useState(!propMentors);
  const [error, setError] = useState('');
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (propMentors) {
      setMentors(propMentors);
      setLoading(false);
    }
  }, [propMentors]);

  const loadMentors = () => {
    api<any>('GET', `/projects/${projectId}/mentors`)
      .then((res) => {
        const data = res.data || [];
        setMentors(data);
        onMentorsChange?.(data);
      })
      .catch((err) => {
        if (err.status !== 403) setError(err.message || 'Failed to load mentors');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!propMentors) {
      loadMentors();
    }
  }, [projectId]);

  const handleAddMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMentorId) return;
    setAdding(true);
    try {
      await api('POST', `/projects/${projectId}/mentors`, { mentorId: selectedMentorId });
      setSelectedMentorId('');
      loadMentors();
      alert('Mentor assigned successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to add mentor');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMentor = async (mentorId: string) => {
    if (!window.confirm('Remove this mentor?')) return;
    try {
      await api('DELETE', `/projects/${projectId}/mentors/${mentorId}`);
      loadMentors();
    } catch (e: any) {
      alert(e.message || 'Failed to remove mentor');
    }
  };

  const handleSetPrimary = async (mentorId: string) => {
    try {
      await api('PATCH', `/projects/${projectId}/mentors/${mentorId}/primary`);
      loadMentors();
    } catch (e: any) {
      alert(e.message || 'Failed to set primary mentor');
    }
  };

  const isAdmin = user?.role === 'project_admin';

  if (error) {
    return (
      <div className="ui-notice ui-notice--error" role="alert">
        <span>{error}</span>
        <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => { setError(''); setLoading(true); loadMentors(); }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="ui-panel prj-mentors" id="mentors" aria-labelledby="prj-mentors-title">
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title" id="prj-mentors-title">
            Mentors
          </h2>
          <span className="ui-panel__meta">
            <Counter value={mentors.length} />
          </span>
        </div>
      </header>

      <div className="ui-panel__body ui-panel__body--flush">
        {loading ? (
          <div className="prj-roster" aria-hidden="true">
            {[0, 1].map((row) => (
              <div className="prj-roster__row" key={row}>
                <span className="ui-skel" style={{ width: 34, height: 34 }} />
                <span className="ui-skel" style={{ flex: 1, height: 12 }} />
              </div>
            ))}
          </div>
        ) : mentors.length ? (
          <ul className="prj-roster">
            {mentors.map((assignment) => {
              const mentor = assignment.mentorId;
              if (!mentor) return null;
              return (
                <li className="ui-row prj-roster__row" key={assignment.assignmentId || assignment._id || mentor._id}>
                  {mentor.profileImage ? (
                    <span className="ui-avatar prj-avatar">
                      <img src={mentor.profileImage} alt="" />
                    </span>
                  ) : (
                    <span className="ui-avatar prj-avatar" aria-hidden="true">
                      {initialOf(mentor.name)}
                    </span>
                  )}
                  <div className="prj-roster__main">
                    <p className="prj-roster__name">{mentor.name}</p>
                    <p className="prj-roster__sub">{mentor.department || 'Faculty mentor'}</p>
                  </div>
                  <span className={`ui-tag ${assignment.isPrimary ? 'is-accent' : 'ui-tag--plain'}`}>
                    {assignment.isPrimary ? 'Primary mentor' : 'Mentor'}
                  </span>
                  {isAdmin && (
                    <div className="ui-row__actions prj-roster__actions">
                      {!assignment.isPrimary && (
                        <button
                          type="button"
                          className="ui-btn ui-btn--quiet ui-btn--sm"
                          onClick={() => handleSetPrimary(mentor._id)}
                        >
                          Make primary
                        </button>
                      )}
                      <button
                        type="button"
                        className="ui-btn ui-btn--danger ui-btn--sm"
                        onClick={() => handleRemoveMentor(mentor._id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="ui-empty prj-empty prj-empty--inset">
            <span className="ui-empty__mark">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
                <path d="M4.8 20c.7-3.8 3.6-6 7.2-6s6.5 2.2 7.2 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            <p className="ui-empty__title">No mentors assigned</p>
            <p className="ui-empty__text">
              {isAdmin ? 'Assign a faculty mentor below.' : 'A project admin assigns the mentor.'}
            </p>
          </div>
        )}
      </div>

      {isAdmin && (
        <footer className="ui-panel__foot prj-mentors__foot">
          <form className="prj-mentors__form" onSubmit={handleAddMentor}>
            <div id="prj-add-mentor" className="prj-mentors__picker" role="group" aria-labelledby="prj-add-mentor-label">
              <span className="ui-visually-hidden" id="prj-add-mentor-label">
                Assign a faculty mentor
              </span>
              <UserSelect
                role="faculty_mentor"
                value={selectedMentorId}
                onChange={setSelectedMentorId}
                placeholder="Search faculty mentors"
                disabledUserIds={mentors
                  .map((m) => (typeof m.mentorId === 'object' ? m.mentorId?._id : m.mentorId))
                  .filter(Boolean)}
                disabledReason="Already assigned"
              />
            </div>
            <button type="submit" className="ui-btn ui-btn--quiet ui-btn--sm" disabled={!selectedMentorId || adding}>
              {adding ? 'Assigning…' : 'Assign mentor'}
            </button>
          </form>
        </footer>
      )}
    </section>
  );
}
