import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { RoleMark } from './RoleMark';
import '../../pages/Clubs/clubs.css';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="m4.5 7 7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/**
 * A member as a ruled entry: a face, a name, one meta line, a role mark, and the
 * actions that only exist while the row is being looked at. The email is an
 * action, not a line of text.
 */
export function MemberItem({ m, clubId, canManage, onRefresh }: { m: any, clubId: string, canManage: boolean, onRefresh: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [membershipType, setMembershipType] = useState(m.membershipType);
  const [position, setPosition] = useState(m.position || '');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const student = m.studentId || {};
  const isCoreTeam = m.membershipType === 'core_team';
  const shownPosition = isCoreTeam && m.position && m.position.toLowerCase() !== 'member' ? m.position : null;

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirming(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  const handleRemove = async () => {
    try {
      setLoading(true);
      await api('DELETE', `/clubs/${clubId}/members/${m.studentId._id}`);
      setConfirming(false);
      onRefresh();
      alert('Member removed successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to remove member');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload: any = { membershipType };
      if (membershipType === 'core_team') {
        payload.position = position;
      } else {
        payload.position = null;
      }
      await api('PATCH', `/clubs/${clubId}/members/${m.studentId._id}`, payload);
      onRefresh();
      setIsEditing(false);
      alert('Membership updated successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to update membership');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`clubs-member${isEditing ? ' is-editing' : ''}`}>
      {student.profileImage ? (
        <img src={student.profileImage} alt="" className="ui-avatar clubs-member__face" />
      ) : (
        <span className="ui-avatar clubs-member__face" aria-hidden="true">{initials(student.name || '?')}</span>
      )}

      <div className="clubs-member__id">
        <div className="clubs-member__name">{student.name || 'Unknown member'}</div>
        <div className="clubs-member__sub">
          {student.department || 'Student'}
          {student.semester ? ` · Semester ${student.semester}` : ''}
        </div>
      </div>

      {isEditing ? (
        <form
          className="clubs-member__form"
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        >
          <div className="clubs-member__form-row">
            <label className="ui-visually-hidden" htmlFor={`member-type-${m._id}`}>Membership type</label>
            <span className="clubs-select">
              <select
                id={`member-type-${m._id}`}
                className="ui-field ui-field--select"
                value={membershipType}
                onChange={e => setMembershipType(e.target.value)}
                disabled={loading}
              >
                <option value="member">Member</option>
                <option value="core_team">Core team</option>
              </select>
            </span>

            {membershipType === 'core_team' && (
              <>
                <label className="ui-visually-hidden" htmlFor={`member-position-${m._id}`}>Position</label>
                <input
                  id={`member-position-${m._id}`}
                  type="text"
                  className="ui-field"
                  placeholder="Position, e.g. President"
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  disabled={loading}
                />
              </>
            )}
          </div>

          <div className="clubs-member__form-row">
            <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => {
                setIsEditing(false);
                setMembershipType(m.membershipType);
                setPosition(m.position || '');
              }}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {shownPosition ? <span className="clubs-member__pos">{shownPosition}</span> : null}

          <RoleMark
            role={isCoreTeam ? 'core' : 'member'}
            label={isCoreTeam ? (shownPosition ? `Core team · ${shownPosition}` : 'Core team') : 'Member'}
            size={18}
            className="clubs-member__role"
          />

          <div className="clubs-member__actions">
            {student.email ? (
              <a
                className="ui-icon-btn clubs-member__mail"
                href={`mailto:${student.email}`}
                aria-label={`Email ${student.name || 'member'}`}
              >
                <MailIcon />
              </a>
            ) : null}
            {canManage ? (
              <>
                <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => setIsEditing(true)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm clubs-member__remove"
                  onClick={() => setConfirming(true)}
                >
                  Remove
                </button>
              </>
            ) : null}
          </div>
        </>
      )}

      {confirming && (
        <div
          className="ui-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) setConfirming(false); }}
        >
          <div className="ui-modal ui-modal--narrow" role="dialog" aria-modal="true" aria-labelledby="clubs-remove-title">
            <div className="ui-modal__head">
              <h2 id="clubs-remove-title" className="ui-panel__title">Remove member</h2>
              <button type="button" className="ui-icon-btn" onClick={() => setConfirming(false)} disabled={loading} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="ui-modal__body">
              <p className="clubs-modal__danger-text">
                <strong>{student.name || 'This member'}</strong> will lose access to the club and its events. You can
                add them again later from the club page.
              </p>
            </div>
            <div className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setConfirming(false)} disabled={loading}>
                Keep member
              </button>
              <button type="button" className="ui-btn ui-btn--danger" onClick={handleRemove} disabled={loading}>
                {loading ? 'Removing…' : 'Remove member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
