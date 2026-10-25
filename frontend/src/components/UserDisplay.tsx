import type { User } from '../types';
import { KindGlyph } from './ui/vis';
import { FieldGlyph, type FieldKind } from '../pages/Profile/icons';
import { initialsOf, roleKind, roleLabel } from '../pages/Profile/labels';
import '../pages/Profile/profile.css';

interface UserDisplayProps {
  user: User | any; // To accept populated mongoose objects which might not perfectly match User
  showRole?: boolean;
  showEmail?: boolean;
  showDepartment?: boolean;
  showSemester?: boolean;
  showEnrollmentNumber?: boolean;
}

interface PersonMark {
  kind: FieldKind;
  label: string;
  value: string;
}

/**
 * A person as two lines: name + role mark, then one run of field marks. Each
 * mark carries its field's glyph, so "enrollment" reads the same here, on the
 * identity plate and in the person picker. Everything is optional — a populated
 * document that is missing a field simply renders one mark fewer.
 */
export function UserDisplay({
  user,
  showRole = false,
  showEmail = true,
  showDepartment = true,
  showSemester = true,
  showEnrollmentNumber = true,
}: UserDisplayProps) {
  if (!user || !user.name) return <span className="prf-person__unknown">Unknown user</span>;

  const isStudent = user.role === 'student';
  const marks: PersonMark[] = [];

  if (showEnrollmentNumber && isStudent && user.enrollmentNumber) {
    marks.push({ kind: 'enrollmentNumber', label: 'Enrollment number', value: String(user.enrollmentNumber) });
  }
  if (showDepartment && user.department) {
    marks.push({ kind: 'department', label: 'Department', value: String(user.department) });
  }
  if (showSemester && isStudent && user.semester) {
    marks.push({ kind: 'semester', label: 'Semester', value: `Sem ${user.semester}` });
  }

  const showSub = (showEmail && user.email) || marks.length > 0;

  return (
    <div className="ui-person prf-person">
      <span className="ui-avatar ui-avatar--sm prf-person__avatar" aria-hidden="true">
        {typeof user.profileImage === 'string' && user.profileImage ? (
          <img src={user.profileImage} alt="" />
        ) : (
          initialsOf(user.name)
        )}
      </span>

      <span className="ui-person__text prf-person__text">
        <span className="prf-person__head">
          <span className="ui-person__name prf-person__name">{user.name}</span>
          {showRole && user.role && (
            <span className="ui-tag ui-tag--plain prf-person__role">
              <KindGlyph kind={roleKind(user.role)} size={11} />
              {roleLabel(user.role)}
            </span>
          )}
        </span>

        {showSub && (
          <span className="prf-person__sub">
            {showEmail && user.email && (
              <a
                className="ui-link prf-person__mark prf-person__mark--link"
                href={`mailto:${user.email}`}
                title={user.email}
              >
                <FieldGlyph kind="email" size={12} />
                <span className="prf-person__mark-text">{user.email}</span>
              </a>
            )}
            {marks.map(mark => (
              <span className="prf-person__mark" key={mark.kind} title={mark.label}>
                <FieldGlyph kind={mark.kind} size={12} />
                <span className="prf-person__mark-text">{mark.value}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
