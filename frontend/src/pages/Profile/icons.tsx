/**
 * icons.tsx — the profile area's 24px glyph set.
 *
 * One weight (1.7), currentColor, round caps, no fills except a 1px optical dot.
 * `FieldGlyph` is the shared field vocabulary: the identity plate's fact grid, the
 * person block and the person picker all draw a field the same way, so a mark
 * position means the same thing wherever a person appears.
 */

import type { ReactNode } from 'react';

export type FieldKind =
  | 'name'
  | 'email'
  | 'phone'
  | 'department'
  | 'semester'
  | 'universityId'
  | 'enrollmentNumber'
  | 'bio'
  | 'memberSince'
  | 'missing'
  | 'complete';

const GLYPHS: Record<FieldKind, ReactNode> = {
  name: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M4.8 20.4c0-3.9 3.2-6 7.2-6s7.2 2.1 7.2 6" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5.6" width="18" height="12.8" rx="2" />
      <path d="m4.4 7.6 6.6 5.1c.6.5 1.4.5 2 0l6.6-5.1" />
    </>
  ),
  phone: (
    <path d="M8.1 4.2 5.4 4.6c-1 .2-1.6 1-1.5 2 .8 7 6.5 12.7 13.5 13.5 1 .1 1.8-.5 2-1.5l.4-2.7-4.2-1.1-1.6 2a12.4 12.4 0 0 1-4.8-4.8l2-1.6Z" />
  ),
  department: (
    <>
      <path d="M4.8 20.4V5.6c0-1 .7-1.6 1.6-1.6h6.8c.9 0 1.6.6 1.6 1.6v14.8" />
      <path d="M3 20.4h18" />
      <path d="M14.8 10h3.4c1 0 1.6.6 1.6 1.6v8.8" />
      <path d="M8 8.2h1.6M11.2 8.2h1.6M8 11.8h1.6M11.2 11.8h1.6" />
    </>
  ),
  semester: (
    <>
      <path d="M3.4 19.8h4.4v-4.7h4.5v-4.8h4.4V5.6" />
      <path d="M3.4 19.8h17.2" />
    </>
  ),
  universityId: (
    <>
      <rect x="3" y="5.4" width="18" height="13.2" rx="2.2" />
      <circle cx="8.4" cy="10.8" r="2.1" />
      <path d="M5.6 15.9c.3-1.6 1.4-2.5 2.8-2.5s2.5.9 2.8 2.5" />
      <path d="M14.2 10.4h4.2M14.2 13.6h4.2" />
    </>
  ),
  enrollmentNumber: (
    <>
      <path d="M9.4 3.6 7.6 20.4M16.4 3.6l-1.8 16.8" />
      <path d="M4 9h16M3.6 15h16" />
    </>
  ),
  bio: <path d="M4 6.4h16M4 12h16M4 17.6h9.6" />,
  memberSince: (
    <>
      <rect x="3.4" y="5.6" width="17.2" height="14.8" rx="2" />
      <path d="M3.4 10.2h17.2M8 3.4v4M16 3.4v4" />
      <circle cx="12" cy="15.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  missing: <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="2.6 2.8" />,
  complete: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export interface FieldGlyphProps {
  kind: FieldKind;
  size?: number;
  className?: string;
}

export function FieldGlyph({ kind, size = 18, className }: FieldGlyphProps) {
  return (
    <svg
      className={className}
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
      {GLYPHS[kind]}
    </svg>
  );
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

export function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4.1L19 9.1a2.1 2.1 0 0 0-3-3L5.1 17 4 20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m14.5 7.5 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function CameraIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.2" y="6.8" width="17.6" height="13" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.6 6.8 10 4.2h4l1.4 2.6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13.2" r="3.3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.6v5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1" fill="currentColor" />
    </svg>
  );
}

export function LockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="5.2" y="10.4" width="13.6" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
