import { useState } from 'react';
import type { CSSProperties } from 'react';
import '../../pages/Clubs/clubs.css';

/** The two significant letters of a club name, used when there is no logo. */
export function monogram(name: string): string {
  const cleaned = name
    .replace(/\b(club|society|committee|association|collective|group|cell)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean);
  if (!words.length) return name.trim().slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export interface CrestProps {
  name: string;
  image?: string | null;
  /** Rendered edge length in px. */
  size?: number;
  /** A cobalt edge: the viewer belongs to this club. */
  lit?: boolean;
  className?: string;
}

/**
 * A club's crest: a cut-corner plate carrying the logo or the monogram. The name
 * always sits beside it, so the crest itself is decorative.
 */
export function Crest({ name, image, size = 40, lit = false, className }: CrestProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(image) && !failed;

  return (
    <span
      className={[
        'clubs-crest',
        lit ? 'is-lit' : '',
        showImage ? 'clubs-crest--image' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--crest': `${size}px`,
          '--crest-cut': `${Math.max(4, Math.round(size * 0.12))}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {showImage ? (
        <img src={image as string} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="clubs-crest__mono">{monogram(name)}</span>
      )}
    </span>
  );
}
