import type { CSSProperties } from 'react';

export interface EventCrestProps {
  name: string;
  logo?: string | null;
  size?: number;
  className?: string;
}

/**
 * The club a mark belongs to, as a die-cut plate: its logo when the API returns
 * one, otherwise the club's initial in the display face. Decorative — the club
 * name always sits beside it (or in the row's accessible name).
 */
export function EventCrest({ name, logo, size = 24, className }: EventCrestProps) {
  const initial = name.trim().charAt(0).toUpperCase() || 'C';

  return (
    <span
      className={`evt-crest${className ? ` ${className}` : ''}`}
      style={{ '--evt-crest': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {logo ? (
        <img src={logo} alt="" />
      ) : (
        <span className="evt-crest__mono">{initial}</span>
      )}
    </span>
  );
}
