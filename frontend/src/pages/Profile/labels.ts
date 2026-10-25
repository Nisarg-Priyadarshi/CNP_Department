/**
 * The three copies of the role vocabulary (profile, person block, person picker)
 * agree here: one label map and one role mark, so an admin reads the same in a
 * table row, a dropdown and the identity plate.
 */

import type { Kind } from '../../components/ui/vis';

export const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  faculty_coordinator: 'Faculty coordinator',
  faculty_mentor: 'Faculty mentor',
  club_admin: 'Club admin',
  project_admin: 'Project admin',
};

export function roleLabel(role?: string): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

/**
 * The role's entity glyph. Decorative: the label beside it carries the meaning,
 * so two faculty roles may share the mentor glyph without ever reading alike.
 */
export function roleKind(role?: string): Kind {
  switch (role) {
    case 'faculty_coordinator':
    case 'faculty_mentor':
      return 'mentor';
    case 'club_admin':
      return 'club';
    case 'project_admin':
      return 'project';
    default:
      return 'member';
  }
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}
