import { useState, useEffect, useId } from 'react';
import { UserSelect } from '../UserSelect';
import { api } from '../../services/api';

function initialOf(name?: string): string {
  return (name || '?').replace(/^Dr\.\s*/i, '').trim().charAt(0).toUpperCase() || '?';
}

export function ProjectManagement({ project, onUpdate }: { project: any; onUpdate: () => void }) {
  const [status, setStatus] = useState(project.status);
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description);

  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const fieldId = useId();

  useEffect(() => {
    setStatus(project.status);
    setEditName(project.name);
    setEditDescription(project.description);
    loadMembers();
  }, [project]);

  const loadMembers = async () => {
    try {
      const res = await api<any>('GET', `/projects/${project._id}/members`);
      setMembers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateDetails = async () => {
    setLoading(true);
    try {
      await api('PATCH', `/projects/${project._id}`, { name: editName, description: editDescription });
      await api('PATCH', `/projects/${project._id}/status`, { status });
      onUpdate();
      alert('Project details updated successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to update details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      await api('POST', `/projects/${project._id}/members`, { studentId: selectedStudentId });
      setSelectedStudentId('');
      loadMembers();
      onUpdate(); // trigger global reload for members in parent
      alert('Student added successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    setLoading(true);
    try {
      await api('DELETE', `/projects/${project._id}/members/${studentId}`);
      loadMembers();
      onUpdate();
      alert('Member removed');
    } catch (e: any) {
      alert(e.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleSetTeamLeader = async (studentId: string) => {
    if (!window.confirm('Set this student as the Team Leader? This will replace the current Team Leader.')) return;
    setLoading(true);
    try {
      await api('PATCH', `/projects/${project._id}/team-leader`, { studentId });
      onUpdate();
      alert('Team Leader updated');
    } catch (e: any) {
      alert(e.message || 'Failed to set team leader');
    } finally {
      setLoading(false);
    }
  };

  const isTL = (m: any) =>
    typeof project.teamLeaderId === 'object'
      ? project.teamLeaderId?._id === m.studentId._id
      : project.teamLeaderId === m.studentId._id;
  const tlMember = members.find((m) => isTL(m));

  return (
    <section className="ui-panel prj-manage" id="manage" aria-labelledby="prj-manage-title">
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title" id="prj-manage-title">
            Project settings
          </h2>
          <span className="ui-panel__meta">Admins only</span>
        </div>
      </header>

      <div className="ui-panel__body">
        <div className="prj-manage__grid">
          <form
            className="prj-manage__section"
            onSubmit={(event) => {
              event.preventDefault();
              handleUpdateDetails();
            }}
          >
            <h3 className="prj-manage__heading">Details</h3>

            <div>
              <label className="ui-label" htmlFor={`${fieldId}-name`}>
                Project name
              </label>
              <input
                id={`${fieldId}-name`}
                type="text"
                className="ui-field"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="ui-label" htmlFor={`${fieldId}-status`}>
                Status
              </label>
              <select
                id={`${fieldId}-status`}
                className="ui-field ui-field--select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={loading}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="ui-label" htmlFor={`${fieldId}-description`}>
                Description
              </label>
              <textarea
                id={`${fieldId}-description`}
                className="ui-field ui-field--area"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                disabled={loading}
              />
            </div>

            <div>
              <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" disabled={loading}>
                {loading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>

          <div className="prj-manage__section">
            <h3 className="prj-manage__heading">Team</h3>

            <div className="prj-manage__leader">
              <span className="prj-manage__leader-label">Current team leader</span>
              {tlMember ? (
                <span className="prj-manage__leader-person">
                  <span className="ui-avatar ui-avatar--sm prj-avatar" aria-hidden="true">
                    {initialOf(tlMember.studentId?.name)}
                  </span>
                  <span>
                    <span className="prj-manage__leader-name">{tlMember.studentId?.name}</span>
                    <span className="prj-manage__leader-sub">
                      {tlMember.studentId?.department || 'Student'}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="ui-notice">No team leader assigned yet.</span>
              )}
            </div>

            <form className="prj-manage__add" onSubmit={handleAddMember}>
              <div id="prj-add-member" role="group" aria-labelledby="prj-add-member-label">
                <p className="ui-label" id="prj-add-member-label">
                  Add a member
                </p>
                <UserSelect
                  role="student"
                  value={selectedStudentId}
                  onChange={(id) => setSelectedStudentId(id)}
                  disabledUserIds={members.map((m: any) => m.studentId?._id || m.studentId)}
                  disabledReason="Already a member"
                  placeholder="Search students by name, email or department"
                  emptyMessage="No registered students found"
                />
              </div>
              <button
                type="submit"
                className="ui-btn ui-btn--quiet ui-btn--sm"
                disabled={loading || !selectedStudentId}
              >
                Add member
              </button>
            </form>

            <div className="prj-manage__roster">
              <p className="prj-manage__roster-label">
                Roster <span className="ui-meta">{members.length}</span>
              </p>
              {members.length ? (
                <ul className="ui-rows">
                  {members.map((member) => (
                    <li className="ui-row prj-manage__member" key={member._id}>
                      <span className="ui-avatar ui-avatar--sm prj-avatar" aria-hidden="true">
                        {initialOf(member.studentId?.name)}
                      </span>
                      <div className="ui-row__main">
                        <div className="ui-row__title">{member.studentId?.name || 'Unknown student'}</div>
                        <div className="ui-row__sub">
                          {isTL(member) ? 'Team leader' : member.studentId?.department || 'Student'}
                        </div>
                      </div>
                      {isTL(member) ? (
                        <span className="ui-tag is-accent">Team leader</span>
                      ) : (
                        <div className="ui-row__actions">
                          <button
                            type="button"
                            className="ui-btn ui-btn--quiet ui-btn--sm"
                            onClick={() => handleSetTeamLeader(member.studentId._id)}
                            disabled={loading}
                          >
                            Make leader
                          </button>
                          <button
                            type="button"
                            className="ui-btn ui-btn--danger ui-btn--sm"
                            onClick={() => handleRemoveMember(member.studentId._id)}
                            disabled={loading}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ui-meta">No members yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
