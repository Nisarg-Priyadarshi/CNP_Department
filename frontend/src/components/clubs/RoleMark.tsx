import type { ReactNode } from 'react';
import { Tooltip } from '../ui/Tooltip';
import '../../pages/Clubs/clubs.css';

export type RoleKind = 'core' | 'member' | 'pending' | 'coordinator' | 'admin';

const MARKS: Record<RoleKind, ReactNode> = {
  /* Rank bars: the core team is a step above the floor. */
  core: <path d="M6 18V13.4M12 18V8.6M18 18V4.6" />,
  /* A person: an ordinary membership. */
  member: (
    <>
      <circle cx="12" cy="8.6" r="3.2" />
      <path d="M6.2 19c.6-3 2.9-4.7 5.8-4.7s5.2 1.7 5.8 4.7" />
    </>
  ),
  /* Waiting. */
  pending: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <path d="M12 8.2v4.2l2.9 1.8" />
    </>
  ),
  /* The faculty seal. */
  coordinator: (
    <>
      <path d="M12 3.6 14 8.1l4.9.5-3.7 3.3 1 4.8-4.2-2.4-4.2 2.4 1-4.8L5.1 8.6l4.9-.5Z" />
    </>
  ),
  /* Stewardship of the directory. */
  admin: (
    <>
      <path d="M12 3.4 19 5.9v5.8c0 4-3 7-7 8.4-4-1.4-7-4.4-7-8.4V5.9Z" />
      <path d="M8.8 11.6h6.4" />
    </>
  ),
};

export interface RoleMarkProps {
  role: RoleKind;
  /** The sentence: accessible name, and the hover inspector. */
  label: string;
  size?: number;
  /** Inside a row that is itself a button: no focus stop, the row name carries the words. */
  quiet?: boolean;
  className?: string;
}

/**
 * One glyph per role so a club's people can be read without a status sentence:
 * core (rank bars), member (dot), pending (clock), coordinator (seal), admin
 * (shield). Meaning is never colour alone — the shapes differ, and every mark
 * carries a word in its accessible name.
 */
export function RoleMark({ role, label, size = 16, quiet = false, className }: RoleMarkProps) {
  const glyph = (
    <span
      className={['clubs-mark', `clubs-mark--${role}`, className ?? ''].filter(Boolean).join(' ')}
      {...(quiet
        ? { 'aria-hidden': true as const, title: label }
        : { role: 'img' as const, 'aria-label': label, tabIndex: 0 })}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {MARKS[role]}
      </svg>
    </span>
  );

  if (quiet) return glyph;
  return <Tooltip label={label}>{glyph}</Tooltip>;
}
