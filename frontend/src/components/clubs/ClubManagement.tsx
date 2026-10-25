import { useState, useEffect, useRef } from 'react';
import { api, API_URL, getStoredToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { UserSelect } from '../UserSelect';
import '../../pages/Clubs/clubs.css';

type Modal = null | 'requests' | 'edit' | 'member' | 'coordinator' | 'images';

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="m5 17 4.5-4.2 3 2.6 3-3.4L20 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UserPlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9.5" cy="8" r="3.3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5M18 8.5v6M15 11.5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 20h4L20 8l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="m14 6 4 4" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const BadgeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="9.5" r="4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M9.5 13.2 8 21l4-2 4 2-1.5-7.8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3.4 12.6h4.3l1.6 2.8h5.4l1.6-2.8h4.3V20H3.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M6.4 12.6V4.4h11.2v8.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function initials(name?: string) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/**
 * The club's whole administration, as one toolbar. Every capability lives behind
 * a key that opens a modal — no panels around the instrument.
 */
export function ClubManagement({ club, onUpdate }: { club: any, onUpdate: () => void }) {
  const clubId = club._id;
  const { user } = useAuth();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingMembers, setExistingMembers] = useState<any[]>([]);
  const [addStudentId, setAddStudentId] = useState('');
  const [addMembershipType, setAddMembershipType] = useState('member');
  const [addPosition, setAddPosition] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  // Edit states
  const [editName, setEditName] = useState(club.name);
  const [editDescription, setEditDescription] = useState(club.description);

  // Coordinator states
  const currentCoordinatorId = typeof club.facultyCoordinatorId === 'object'
    ? club.facultyCoordinatorId?._id || ''
    : club.facultyCoordinatorId || '';
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState(currentCoordinatorId);

  useEffect(() => {
    const cid = typeof club.facultyCoordinatorId === 'object'
      ? club.facultyCoordinatorId?._id || ''
      : club.facultyCoordinatorId || '';
    setSelectedCoordinatorId(cid);
  }, [club.facultyCoordinatorId]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const loadRequests = async () => {
    try {
      const reqs = await api<any>('GET', `/join-requests/club/${clubId}`).then(res => res.data);
      setRequests(reqs.filter((r: any) => r.status === 'pending'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const res = await api<any>('GET', `/clubs/${clubId}/members`);
      setExistingMembers(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadRequests();
    loadMembers();
  }, [clubId, user]);

  const handleUpdateDetails = async () => {
    setSaving(true);
    try {
      await api('PATCH', `/clubs/${clubId}`, { name: editName, description: editDescription });
      setModal(null);
      onUpdate();
      alert('Club details updated successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to update details');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignCoordinator = async () => {
    setAssigning(true);
    try {
      await api('PATCH', `/clubs/${clubId}/coordinator`, { facultyCoordinatorId: selectedCoordinatorId || null });
      setModal(null);
      onUpdate();
      alert('Coordinator updated successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to update coordinator');
    } finally {
      setAssigning(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api('PATCH', `/join-requests/${id}/approve`);
      setRequests(requests.filter(r => r._id !== id));
      loadMembers();
      onUpdate();
      alert('Request approved');
    } catch (e: any) {
      alert(e.message || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api('PATCH', `/join-requests/${id}/reject`);
      setRequests(requests.filter(r => r._id !== id));
      alert('Request rejected');
    } catch (e: any) {
      alert(e.message || 'Failed to reject');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStudentId) return alert('Please select a student');

    try {
      setSaving(true);
      await api('POST', `/clubs/${clubId}/members`, {
        studentId: addStudentId,
        membershipType: addMembershipType,
        position: addMembershipType === 'core_team' ? addPosition : undefined
      });
      alert('Member added successfully');
      setAddStudentId('');
      setAddPosition('');
      setAddMembershipType('member');
      loadMembers();
      onUpdate();
      setModal(null);
    } catch (e: any) {
      alert(e.message || 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch(`${API_URL}/clubs/${clubId}/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getStoredToken()}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to upload logo');

      alert('Logo updated successfully');
      window.location.reload(); // Refresh to show new logo everywhere
    } catch (error: any) {
      alert(error.message || 'Error uploading logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('coverImage', file);

      const res = await fetch(`${API_URL}/clubs/${clubId}/cover_image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getStoredToken()}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to upload cover image');

      alert('Cover image updated successfully');
      window.location.reload(); // Refresh to show new cover everywhere
    } catch (error: any) {
      alert(error.message || 'Error uploading cover image');
    } finally {
      setUploadingCover(false);
      if (coverImageInputRef.current) coverImageInputRef.current.value = '';
    }
  };

  const existingMemberIds = existingMembers.map((m: any) =>
    typeof m.studentId === 'object' ? m.studentId?._id : m.studentId
  ).filter(Boolean);

  return (
    <>
      <div className="clubs-toolbar" role="toolbar" aria-label="Manage this club">
        <button
          type="button"
          className={`ui-btn ui-btn--quiet ui-btn--sm clubs-toolbar__requests${requests.length ? ' is-waiting' : ''}`}
          onClick={() => setModal('requests')}
        >
          <InboxIcon />
          Requests
          <span className={`ui-count${requests.length ? ' ui-count--accent' : ''}`}>
            {loading ? '·' : requests.length}
          </span>
        </button>

        <span className="clubs-toolbar__sep" aria-hidden="true" />

        {user?.role === 'club_admin' && (
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => setModal('edit')}>
            <EditIcon />
            Edit
          </button>
        )}
        <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => setModal('member')}>
          <UserPlusIcon />
          Add member
        </button>
        {user?.role === 'club_admin' && (
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => setModal('coordinator')}>
            <BadgeIcon />
            Coordinator
          </button>
        )}
        <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => setModal('images')}>
          <ImageIcon />
          Images
        </button>
      </div>

      {modal === 'requests' && (
        <div className="ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-requests-title">
            <div className="ui-modal__head">
              <div className="ui-panel__titles">
                <h2 id="clubs-requests-title" className="ui-panel__title">Join requests</h2>
                <span className="ui-panel__meta">{requests.length}</span>
              </div>
              <button type="button" className="ui-icon-btn" onClick={() => setModal(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>

            <div className="ui-panel__body ui-panel__body--flush">
              {loading ? (
                <div className="clubs-skel clubs-skel--row">
                  <div className="ui-skel clubs-skel__plate clubs-skel__plate--sm" />
                  <div className="clubs-skel__body">
                    <div className="ui-skel clubs-skel__line clubs-skel__line--title" />
                    <div className="ui-skel clubs-skel__line clubs-skel__line--short" />
                  </div>
                </div>
              ) : requests.length ? (
                <div>
                  {requests.map(r => (
                    <div key={r._id} className="clubs-requests__row">
                      {r.studentId?.profileImage ? (
                        <img src={r.studentId.profileImage} alt="" className="ui-avatar" />
                      ) : (
                        <span className="ui-avatar" aria-hidden="true">{initials(r.studentId?.name)}</span>
                      )}

                      <div className="ui-grow">
                        <div className="clubs-member__name">{r.studentId?.name || 'Unknown student'}</div>
                        <div className="clubs-requests__meta">
                          <a href={`mailto:${r.studentId?.email}`}>{r.studentId?.email}</a>
                          {r.studentId?.department ? ` · ${r.studentId.department}` : ''}
                          {r.studentId?.semester ? ` · Semester ${r.studentId.semester}` : ''}
                          {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}` : ''}
                        </div>
                      </div>

                      <div className="clubs-requests__actions">
                        <button type="button" className="ui-btn ui-btn--sm" onClick={() => handleApprove(r._id)}>
                          <CheckIcon />
                          Approve
                        </button>
                        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm clubs-requests__reject" onClick={() => handleReject(r._id)}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="clubs-admin__empty">
                  <CheckIcon />
                  <span>No requests waiting.</span>
                </div>
              )}
            </div>

            <div className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'edit' && (
        <div className="ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-edit-title">
            <div className="ui-modal__head">
              <div>
                <h2 id="clubs-edit-title" className="ui-panel__title">Edit club details</h2>
              </div>
              <button type="button" className="ui-icon-btn" onClick={() => setModal(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateDetails(); }}>
              <div className="ui-modal__body clubs-modal__body">
                <div>
                  <label className="ui-label" htmlFor="clubs-edit-name">Club name</label>
                  <input
                    id="clubs-edit-name"
                    className="ui-field"
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    disabled={saving}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="ui-label" htmlFor="clubs-edit-description">Description</label>
                  <textarea
                    id="clubs-edit-description"
                    className="ui-field ui-field--area"
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={4}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="ui-modal__foot">
                <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setModal(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'member' && (
        <div className="ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-member-title">
            <div className="ui-modal__head">
              <div>
                <h2 id="clubs-member-title" className="ui-panel__title">Add member</h2>
              </div>
              <button type="button" className="ui-icon-btn" onClick={() => setModal(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="ui-modal__body clubs-modal__body">
                <div>
                  <label className="ui-label" htmlFor="clubs-add-student">Student</label>
                  <UserSelect
                    id="clubs-add-student"
                    role="student"
                    value={addStudentId}
                    onChange={setAddStudentId}
                    placeholder="Search and select student…"
                    disabledUserIds={existingMemberIds}
                    disabledReason="Already a member"
                  />
                </div>

                <div>
                  <label className="ui-label" htmlFor="clubs-add-type">Membership</label>
                  <span className="clubs-select">
                    <select
                      id="clubs-add-type"
                      className="ui-field ui-field--select"
                      value={addMembershipType}
                      onChange={e => setAddMembershipType(e.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="core_team">Core team</option>
                    </select>
                  </span>
                </div>

                {addMembershipType === 'core_team' && (
                  <div>
                    <label className="ui-label" htmlFor="clubs-add-position">Position</label>
                    <input
                      id="clubs-add-position"
                      type="text"
                      className="ui-field"
                      placeholder="e.g. Technical lead"
                      value={addPosition}
                      onChange={e => setAddPosition(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="ui-modal__foot">
                <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setModal(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={!addStudentId || saving}>
                  {saving ? 'Adding…' : 'Add member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'coordinator' && (
        <div className="ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-coordinator-title">
            <div className="ui-modal__head">
              <div>
                <h2 id="clubs-coordinator-title" className="ui-panel__title">Faculty coordinator</h2>
              </div>
              <button type="button" className="ui-icon-btn" onClick={() => setModal(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="ui-modal__body clubs-modal__body">
              <div className="clubs-upload">
                <div className="clubs-upload__text">
                  <p className="clubs-upload__title">
                    {club.facultyCoordinatorId
                      ? (typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId.name : club.facultyCoordinatorId)
                      : 'No coordinator assigned'}
                  </p>
                  {typeof club.facultyCoordinatorId === 'object' && club.facultyCoordinatorId?.email ? (
                    <p className="clubs-upload__hint">{club.facultyCoordinatorId.email}</p>
                  ) : null}
                </div>
                <span className={`ui-tag ${club.facultyCoordinatorId ? 'is-positive' : 'is-warning'}`}>
                  {club.facultyCoordinatorId ? 'Assigned' : 'Unassigned'}
                </span>
              </div>

              <div>
                <label className="ui-label" htmlFor="clubs-coordinator-select">Assign or reassign</label>
                <UserSelect
                  id="clubs-coordinator-select"
                  role="faculty_coordinator"
                  value={selectedCoordinatorId}
                  onChange={setSelectedCoordinatorId}
                  placeholder="Search and select faculty coordinator…"
                  disabledUserIds={currentCoordinatorId ? [currentCoordinatorId] : []}
                  disabledReason="Currently assigned"
                />
              </div>
            </div>
            <div className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setModal(null)} disabled={assigning}>
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={handleAssignCoordinator}
                disabled={assigning || selectedCoordinatorId === currentCoordinatorId}
              >
                {assigning ? 'Updating…' : 'Update assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'images' && (
        <div className="ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-images-title">
            <div className="ui-modal__head">
              <div>
                <h2 id="clubs-images-title" className="ui-panel__title">Club images</h2>
              </div>
              <button type="button" className="ui-icon-btn" onClick={() => setModal(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="ui-modal__body clubs-modal__body">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleLogoUpload} className="ui-visually-hidden" id="clubs-logo-input" />
              <div className="clubs-upload">
                <div className="clubs-upload__text">
                  <p className="clubs-upload__title">Logo</p>
                  <p className="clubs-upload__hint">Square, 400 px or larger.</p>
                </div>
                <button type="button" className="ui-btn ui-btn--sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? 'Uploading…' : 'Choose logo'}
                </button>
              </div>

              <input type="file" accept="image/*" ref={coverImageInputRef} onChange={handleCoverImageUpload} className="ui-visually-hidden" id="clubs-cover-input" />
              <div className="clubs-upload">
                <div className="clubs-upload__text">
                  <p className="clubs-upload__title">Cover image</p>
                  <p className="clubs-upload__hint">Wide, around 1600 × 400 px.</p>
                </div>
                <button type="button" className="ui-btn ui-btn--sm" disabled={uploadingCover} onClick={() => coverImageInputRef.current?.click()}>
                  {uploadingCover ? 'Uploading…' : 'Choose cover'}
                </button>
              </div>
            </div>
            <div className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
