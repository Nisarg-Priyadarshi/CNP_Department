import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { User } from '../../types';
import { Counter, DateTile, KindGlyph, Ring, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import { initialsOf, roleKind, roleLabel } from './labels';
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  FieldGlyph,
  LockIcon,
  PencilIcon,
  type FieldKind,
} from './icons';
import './profile.css';

type ProfileUser = User & { createdAt?: string };

/** The fields that can be missing, and therefore can be focused from the plate. */
type EditField = 'name' | 'department' | 'phone' | 'universityId' | 'semester' | 'bio';

interface CompletenessField {
  key: EditField;
  label: string;
  done: boolean;
}

const stagger = (i: number) => ({ '--prf-i': i } as CSSProperties);

export default function Profile() {
  const { user, updateUser } = useAuth();
  const profileUser = user as ProfileUser | null;

  const isStudent = user?.role === 'student';
  const hasDept = !!(user?.department && user.department.trim());
  const hasPhone = !!(user?.phone && user.phone.trim());
  const hasUniId = !!(user?.universityId && user.universityId.trim());
  const hasSemester = !!user?.semester;
  const hasName = !!(user?.name && user.name.trim());
  // The exact predicate behind isProfileComplete() in AuthContext.
  const isProfileComplete = hasName && hasDept && hasPhone && (isStudent ? (hasUniId && hasSemester) : true);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    department: user?.department || '',
    universityId: user?.universityId || '',
    enrollmentNumber: user?.enrollmentNumber || '',
    semester: user?.semester || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState<'email' | 'phone' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const departmentInputRef = useRef<HTMLInputElement>(null);
  const universityIdInputRef = useRef<HTMLInputElement>(null);
  const semesterInputRef = useRef<HTMLInputElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const focusEditRef = useRef(false);
  const focusReadRef = useRef(false);
  const focusFieldRef = useRef<EditField>('name');
  const copyTimer = useRef<number | null>(null);

  const fieldRefs: Record<EditField, RefObject<HTMLElement | null>> = {
    name: nameInputRef,
    department: departmentInputRef,
    phone: phoneInputRef,
    universityId: universityIdInputRef,
    semester: semesterInputRef,
    bio: bioInputRef,
  };

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isEditing && focusEditRef.current) {
      focusEditRef.current = false;
      fieldRefs[focusFieldRef.current].current?.focus();
    } else if (!isEditing && focusReadRef.current) {
      focusReadRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [isEditing]);

  if (!user) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api<any>('PATCH', '/users/profile', formData);
      updateUser(res.data);
      setSuccess('Profile updated');
      focusReadRef.current = true;
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const fd = new FormData();
    fd.append('image', file);

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const res = await api<any>('POST', '/users/profile-image', fd);
      updateUser({ ...user, profileImage: res.data.profileImage });
      setSuccess('Profile image updated');
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    focusReadRef.current = true;
    setIsEditing(false);
    setFormData({
      name: user.name || '',
      department: user.department || '',
      universityId: user.universityId || '',
      enrollmentNumber: user.enrollmentNumber || '',
      semester: user.semester || '',
      phone: user.phone || '',
      bio: user.bio || '',
    });
    setError('');
    setSuccess('');
  };

  const handleStartEdit = (field: EditField = 'name') => {
    setError('');
    setSuccess('');
    focusFieldRef.current = field;
    focusEditRef.current = true;
    setIsEditing(true);
  };

  const copyValue = async (value: string, kind: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* Clipboard is unavailable outside a secure context; the mailto/tel link remains. */
    }
  };

  // MOCK: no completeness field exists — the percentage is derived client-side
  // from the same required-field predicate as isProfileComplete(). While editing
  // it previews the unsaved form so the gauge answers the fields above it.
  const source = isEditing
    ? {
        name: formData.name,
        department: formData.department,
        phone: formData.phone,
        universityId: formData.universityId,
        semester: formData.semester as string | number | undefined,
      }
    : {
        name: user.name,
        department: user.department,
        phone: user.phone,
        universityId: user.universityId,
        semester: user.semester as string | number | undefined,
      };

  const completeness: CompletenessField[] = [
    { key: 'name', label: 'Name', done: !!(source.name && source.name.trim()) },
    { key: 'department', label: 'Department', done: !!(source.department && source.department.trim()) },
    { key: 'phone', label: 'Phone number', done: !!(source.phone && source.phone.trim()) },
    ...(isStudent
      ? [
          {
            key: 'universityId' as const,
            label: 'University ID',
            done: !!(source.universityId && source.universityId.trim()),
          },
          { key: 'semester' as const, label: 'Semester', done: !!source.semester },
        ]
      : []),
  ];
  const doneCount = completeness.filter(field => field.done).length;
  const percent = Math.round((doneCount / completeness.length) * 100);
  const missing = completeness.filter(field => !field.done);

  // MOCK: createdAt is returned by Mongoose but is not part of the documented
  // User shape; the tile is omitted when the field is absent.
  const rawCreatedAt = profileUser?.createdAt;
  const createdAtDate = rawCreatedAt ? new Date(rawCreatedAt) : null;
  const memberSince = createdAtDate && !Number.isNaN(createdAtDate.getTime()) ? createdAtDate : null;

  const identityName = (isEditing ? formData.name.trim() : user.name) || user.name;
  const identityDepartment = (isEditing ? formData.department : user.department) || user.department;
  const identitySemester = (isEditing ? formData.semester : user.semester) || user.semester;
  const identityUniversityId = (isEditing ? formData.universityId : user.universityId) || user.universityId;
  const identityEnrollment = (isEditing ? formData.enrollmentNumber : user.enrollmentNumber) || user.enrollmentNumber;

  const facts: { kind: FieldKind; label: string; value: string }[] = [];
  if (identityDepartment) facts.push({ kind: 'department', label: 'Department', value: identityDepartment });
  if (isStudent && identitySemester) {
    facts.push({ kind: 'semester', label: 'Semester', value: String(identitySemester) });
  }
  if (isStudent && identityUniversityId) {
    facts.push({ kind: 'universityId', label: 'University ID', value: identityUniversityId });
  }
  if (isStudent && identityEnrollment) {
    facts.push({ kind: 'enrollmentNumber', label: 'Enrollment', value: identityEnrollment });
  }

  return (
    <div className="prf-page">
      <header className="ui-page-head">
        <div className="ui-page-head__text">
          <h1 className="ui-title">Profile</h1>
        </div>
        <div className="ui-page-actions">
          {isEditing ? (
            <>
              {isProfileComplete && (
                <button type="button" className="ui-btn ui-btn--ghost" onClick={handleCancel} disabled={loading}>
                  Cancel
                </button>
              )}
              <button type="submit" form="prf-profile-form" className="ui-btn ui-btn--primary" disabled={loading}>
                {loading ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <button
              ref={editButtonRef}
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={() => handleStartEdit('name')}
            >
              <PencilIcon />
              Edit profile
            </button>
          )}
        </div>
      </header>

      {(error || success) && (
        <div className="prf-notices">
          {error && (
            <div className="ui-notice ui-notice--error" role="alert">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="ui-notice ui-notice--positive" role="status">
              <CheckIcon />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      {/* ── The identity plate ───────────────────────────────────────────── */}
      <section
        className={`ui-panel ui-panel--accent prf-plate prf-enter${isEditing ? ' prf-plate--editing' : ''}`}
        style={stagger(0)}
        aria-labelledby="prf-name"
      >
        <div className="prf-plate__body">
          <div className="prf-portrait">
            <span className="prf-portrait__face">
              {user.profileImage ? (
                <img src={user.profileImage} alt="" />
              ) : (
                <span className="prf-portrait__mono" aria-hidden="true">{initialsOf(identityName)}</span>
              )}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="ui-visually-hidden"
              tabIndex={-1}
            />
            <Tooltip label={user.profileImage ? 'Replace photo' : 'Add a photo'}>
              <button
                type="button"
                className="prf-portrait__action"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label={user.profileImage ? 'Replace profile photo' : 'Upload profile photo'}
              >
                <CameraIcon />
              </button>
            </Tooltip>
          </div>

          <div className="prf-plate__id">
            <div className="prf-plate__line">
              <h2 className="prf-name" id="prf-name">{identityName}</h2>
              <span className="prf-role">
                <KindGlyph kind={roleKind(user.role)} size={13} />
                {roleLabel(user.role)}
              </span>
            </div>
          </div>

          {memberSince && (
            <div className="prf-since">
              <span className="prf-since__label">Member since</span>
              <span className="prf-since__date">
                <DateTile date={memberSince} size="lg" />
                <span className="prf-since__year">{memberSince.getFullYear()}</span>
              </span>
            </div>
          )}
        </div>

        {facts.length > 0 && (
          <ul className="prf-facts">
            {facts.map(fact => (
              <li className="prf-fact" key={fact.label}>
                <span className="prf-fact__tile" aria-hidden="true">
                  <FieldGlyph kind={fact.kind} size={16} />
                </span>
                <span className="prf-fact__text">
                  <span className="prf-fact__label">{fact.label}</span>
                  <span className="prf-fact__value">{fact.value}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="prf-strength">
          <span
            className="prf-strength__gauge"
            role="img"
            aria-label={`Profile strength ${percent} percent, ${doneCount} of ${completeness.length} details on file`}
          >
            <Ring value={percent / 100} size={56} thickness={5} />
            <span className="prf-strength__pct" aria-hidden="true">
              <Counter value={percent} duration={620} format={n => String(Math.round(n))} />
              <span className="prf-strength__unit">%</span>
            </span>
          </span>

          <span className="prf-strength__readout">
            <span className="prf-strength__title">Profile strength</span>
            <span className="prf-strength__ratio">
              {doneCount} of {completeness.length}
            </span>
          </span>

          <Segments
            className="prf-strength__scale"
            value={doneCount}
            total={completeness.length}
            segments={completeness.length}
            ariaLabel={`${doneCount} of ${completeness.length} details on file`}
          />

          {missing.length > 0 ? (
            <ul className="prf-strength__missing">
              {missing.map(field => (
                <li key={field.key}>
                  {isEditing ? (
                    <button
                      type="button"
                      className="prf-miss"
                      onClick={() => fieldRefs[field.key].current?.focus()}
                      aria-label={`Go to ${field.label.toLowerCase()}`}
                    >
                      <FieldGlyph kind={field.key as FieldKind} size={13} />
                      {field.label}
                    </button>
                  ) : (
                    <Tooltip label={`Add ${field.label.toLowerCase()}`}>
                      <button
                        type="button"
                        className="prf-miss"
                        onClick={() => handleStartEdit(field.key)}
                        aria-label={`Add ${field.label.toLowerCase()}`}
                      >
                        <FieldGlyph kind={field.key as FieldKind} size={13} />
                        {field.label}
                      </button>
                    </Tooltip>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <span className="prf-strength__done">
              <CheckIcon size={14} />
              Complete
            </span>
          )}
        </div>
      </section>

      {/* ── Read mode · ruled record ─────────────────────────────────────── */}
      {!isEditing && (
        <div className="prf-record">
          <section className="prf-block prf-enter" style={stagger(1)} aria-labelledby="prf-about">
            <div className="prf-block__head">
              <h2 className="prf-block__title" id="prf-about">About</h2>
              {user.bio && (
                <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => handleStartEdit('bio')}>
                  <PencilIcon size={13} />
                  Edit
                </button>
              )}
            </div>
            {user.bio ? (
              <p className="prf-bio">{user.bio}</p>
            ) : (
              <div className="prf-block__empty">
                <p className="prf-block__empty-text">No bio yet.</p>
                <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => handleStartEdit('bio')}>
                  Add a bio
                </button>
              </div>
            )}
          </section>

          <div className="prf-record__side">
            <section className="prf-block prf-enter" style={stagger(2)} aria-labelledby="prf-contact">
              <div className="prf-block__head">
                <h2 className="prf-block__title" id="prf-contact">Contact</h2>
              </div>
              <ul className="prf-contact">
                <li className="prf-contact__row">
                  <span className="prf-contact__mark" aria-hidden="true">
                    <FieldGlyph kind="email" size={16} />
                  </span>
                  <a className="ui-link prf-contact__value" href={`mailto:${user.email}`}>{user.email}</a>
                  <Tooltip label={copied === 'email' ? 'Copied' : 'Copy email'}>
                    <button
                      type="button"
                      className="ui-icon-btn prf-copy"
                      onClick={() => copyValue(user.email, 'email')}
                      aria-label="Copy email address"
                    >
                      {copied === 'email' ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  </Tooltip>
                </li>
                <li className="prf-contact__row">
                  <span className="prf-contact__mark" aria-hidden="true">
                    <FieldGlyph kind="phone" size={16} />
                  </span>
                  {user.phone ? (
                    <>
                      <a className="ui-link prf-contact__value" href={`tel:${user.phone}`}>{user.phone}</a>
                      <Tooltip label={copied === 'phone' ? 'Copied' : 'Copy phone'}>
                        <button
                          type="button"
                          className="ui-icon-btn prf-copy"
                          onClick={() => copyValue(user.phone as string, 'phone')}
                          aria-label="Copy phone number"
                        >
                          {copied === 'phone' ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </Tooltip>
                    </>
                  ) : (
                    <span className="prf-contact__value prf-contact__value--empty">Not provided</span>
                  )}
                </li>
              </ul>
            </section>

            <section className="prf-block prf-enter" style={stagger(3)} aria-labelledby="prf-account">
              <div className="prf-block__head">
                <h2 className="prf-block__title" id="prf-account">Account</h2>
              </div>
              <dl className="prf-acct">
                <div className="prf-acct__cell">
                  <dt className="prf-acct__label">Role</dt>
                  <dd className="prf-acct__value">{roleLabel(user.role)}</dd>
                </div>
                <div className="prf-acct__cell">
                  <dt className="prf-acct__label">Photo</dt>
                  <dd className="prf-acct__value">{user.profileImage ? 'Uploaded' : 'Monogram'}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      )}

      {/* ── Edit mode · one sheet, two columns, rules between ───────────── */}
      {isEditing && (
        <form
          className="ui-panel prf-sheet prf-enter"
          id="prf-profile-form"
          style={stagger(1)}
          onSubmit={handleSave}
        >
          <div className="prf-sheet__cols">
            <div className="prf-sheet__col">
              <section className="prf-sheet__section">
                <h2 className="prf-sheet__title">Identity</h2>
                <div className="ui-form-row ui-form-row--2">
                  <div className="prf-field">
                    <label className="ui-label" htmlFor="prf-full-name">
                      Full name <span className="prf-req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="prf-full-name"
                      ref={nameInputRef}
                      className="ui-field"
                      type="text"
                      autoComplete="name"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="prf-field">
                    <div className="prf-field__labelrow">
                      <label className="ui-label" htmlFor="prf-email">Email address</label>
                      <Tooltip label="Managed by your college account">
                        <span
                          className="prf-field__note"
                          role="img"
                          aria-label="Managed by your college account"
                          tabIndex={0}
                        >
                          <LockIcon />
                        </span>
                      </Tooltip>
                    </div>
                    <input id="prf-email" className="ui-field" type="email" value={user.email} disabled />
                  </div>
                </div>
              </section>

              <section className="prf-sheet__section">
                <h2 className="prf-sheet__title">Contact</h2>
                <div className="prf-field">
                  <label className="ui-label" htmlFor="prf-phone">
                    Phone number <span className="prf-req" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="prf-phone"
                    ref={phoneInputRef}
                    className="ui-field"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
              </section>
            </div>

            <div className="prf-sheet__col">
              <section className="prf-sheet__section">
                <h2 className="prf-sheet__title">{isStudent ? 'Academic record' : 'Department'}</h2>
                {isStudent ? (
                  <>
                    <div className="ui-form-row ui-form-row--2">
                      <div className="prf-field">
                        <label className="ui-label" htmlFor="prf-department">
                          Department <span className="prf-req" aria-hidden="true">*</span>
                        </label>
                        <input
                          id="prf-department"
                          ref={departmentInputRef}
                          className="ui-field"
                          type="text"
                          value={formData.department}
                          onChange={e => setFormData({ ...formData, department: e.target.value })}
                          required
                          disabled={loading}
                        />
                      </div>
                      <div className="prf-field">
                        <label className="ui-label" htmlFor="prf-semester">
                          Semester <span className="prf-req" aria-hidden="true">*</span>
                        </label>
                        <input
                          id="prf-semester"
                          ref={semesterInputRef}
                          className="ui-field"
                          type="number"
                          min="1"
                          max="10"
                          value={formData.semester}
                          onChange={e => setFormData({ ...formData, semester: e.target.value })}
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="ui-form-row ui-form-row--2">
                      <div className="prf-field">
                        <label className="ui-label" htmlFor="prf-university-id">
                          University ID <span className="prf-req" aria-hidden="true">*</span>
                        </label>
                        <input
                          id="prf-university-id"
                          ref={universityIdInputRef}
                          className="ui-field"
                          type="text"
                          value={formData.universityId}
                          onChange={e => setFormData({ ...formData, universityId: e.target.value })}
                          required
                          disabled={loading}
                        />
                      </div>
                      <div className="prf-field">
                        <label className="ui-label" htmlFor="prf-enrollment">Enrollment number</label>
                        <input
                          id="prf-enrollment"
                          className="ui-field"
                          type="text"
                          value={formData.enrollmentNumber}
                          onChange={e => setFormData({ ...formData, enrollmentNumber: e.target.value })}
                          disabled={loading}
                          placeholder="e.g. 0901CS201045"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="prf-field">
                    <label className="ui-label" htmlFor="prf-department">
                      Department <span className="prf-req" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="prf-department"
                      ref={departmentInputRef}
                      className="ui-field"
                      type="text"
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>
                )}
              </section>

              <section className="prf-sheet__section">
                <h2 className="prf-sheet__title">About</h2>
                <div className="prf-field">
                  <label className="ui-label" htmlFor="prf-bio">Bio</label>
                  <textarea
                    id="prf-bio"
                    ref={bioInputRef}
                    className="ui-field ui-field--area"
                    rows={3}
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    disabled={loading}
                    placeholder="Research, interests, responsibilities"
                  />
                </div>
              </section>
            </div>
          </div>

          <footer className="prf-sheet__foot">
            {isProfileComplete && (
              <button type="button" className="ui-btn ui-btn--ghost" onClick={handleCancel} disabled={loading}>
                Cancel
              </button>
            )}
            <button type="submit" className="ui-btn ui-btn--primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      )}

      <span className="ui-visually-hidden" aria-live="polite">
        {copied === 'email' ? 'Email address copied' : copied === 'phone' ? 'Phone number copied' : ''}
      </span>
    </div>
  );
}
