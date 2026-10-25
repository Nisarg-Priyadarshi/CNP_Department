import { describe, expect, it } from 'vitest';
import { isProfileComplete } from './AuthContext';
import { makeUser } from '../test/fixtures';

describe('isProfileComplete()', () => {
  it('rejects a missing user', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it('accepts a student with all five fields', () => {
    expect(isProfileComplete(makeUser())).toBe(true);
  });

  it.each(['name', 'department', 'phone', 'universityId'] as const)(
    'rejects a student whose %s is missing',
    (field) => {
      expect(isProfileComplete(makeUser({ [field]: undefined }))).toBe(false);
    },
  );

  it.each(['name', 'department', 'phone', 'universityId'] as const)(
    'treats whitespace-only %s as missing',
    (field) => {
      expect(isProfileComplete(makeUser({ [field]: '   ' }))).toBe(false);
      expect(isProfileComplete(makeUser({ [field]: '\n\t' }))).toBe(false);
    },
  );

  it('rejects a student with no semester', () => {
    expect(isProfileComplete(makeUser({ semester: undefined }))).toBe(false);
  });

  it('treats semester 0 as missing (falsy check, not a presence check)', () => {
    expect(isProfileComplete(makeUser({ semester: 0 }))).toBe(false);
  });

  it('accepts a student in any non-zero semester, including a string one', () => {
    expect(isProfileComplete(makeUser({ semester: 1 }))).toBe(true);
    // The API has sent semester as a string before; the current check accepts it.
    expect(isProfileComplete(makeUser({ semester: '4' as unknown as number }))).toBe(true);
  });

  it.each(['faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'])(
    'does not require universityId or semester for %s',
    (role) => {
      const staff = makeUser({ role, universityId: undefined, semester: undefined });
      expect(isProfileComplete(staff)).toBe(true);
    },
  );

  it.each(['faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'])(
    'still requires name, department and phone for %s',
    (role) => {
      expect(isProfileComplete(makeUser({ role, phone: '' }))).toBe(false);
      expect(isProfileComplete(makeUser({ role, department: '  ' }))).toBe(false);
      expect(isProfileComplete(makeUser({ role, name: '' }))).toBe(false);
    },
  );
});
