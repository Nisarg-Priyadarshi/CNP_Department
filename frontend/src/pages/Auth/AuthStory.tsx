import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   The auth story panel — the brand anchor of /login and /register.

   Cobalt re-ink of the original composition: a graphite plate (the rail's
   tone), one cobalt light, paper cards, and the campus drawn in hairlines.
   No gold, no indigo, no third typeface. Every mark is CSS or inline SVG.

   The panel is presentational: the slide interval, the hover pause and the
   indicator state live in the calling page, because they are what the auth
   contract already promised.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AuthSlide {
  eyebrow: ReactNode;
  title: ReactNode;
  body: string;
  foot: string;
}

interface AuthStoryProps {
  slides: AuthSlide[];
  active: number;
  onSelect?: (index: number) => void;
  onHoverChange?: (hovered: boolean) => void;
}

/* ── The marks ───────────────────────────────────────────────────────────── */

function PeopleGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 12.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM5.8 19.2c.5-2.5 2.8-4.2 6.2-4.2s5.7 1.7 6.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CodeGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="m9 8-4 4 4 4m6-8 4 4-4 4m-1.5-10-3 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 12h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Slide 0: the campus ─────────────────────────────────────────────────── */

function CampusArt() {
  return (
    <>
      <span className="auth-orbit auth-orbit--one" />
      <span className="auth-orbit auth-orbit--two" />
      <span className="auth-spark auth-spark--one" />
      <span className="auth-spark auth-spark--two" />

      <div className="auth-note-card auth-note-card--club">
        <span className="auth-note-card__icon"><PeopleGlyph /></span>
        <span className="auth-note-card__text">
          <strong>Student clubs</strong>
          <small>Ideas take shape together</small>
        </span>
      </div>

      <div className="auth-note-card auth-note-card--project">
        <span className="auth-note-card__icon"><CodeGlyph /></span>
        <span className="auth-note-card__text">
          <strong>GUIITAR projects</strong>
          <small>Built by the campus community</small>
        </span>
      </div>

      <div className="auth-campus">
        <span className="auth-campus__sun" />
        <div className="auth-building">
          <span className="auth-building__roof" />
          <span className="auth-building__top"><i /><i /><i /></span>
          <span className="auth-building__columns"><i /><i /><i /><i /><i /></span>
          <span className="auth-building__steps" />
        </div>
        <span className="auth-campus__ground" />
      </div>
    </>
  );
}

/* ── Slide 1: the community ──────────────────────────────────────────────── */

function CommunityArt() {
  return (
    <div className="auth-web">
      <span className="auth-web__ring" />
      <span className="auth-web__node auth-web__node--one"><PeopleGlyph /></span>
      <span className="auth-web__node auth-web__node--two"><PeopleGlyph /></span>
      <span className="auth-web__node auth-web__node--three"><PeopleGlyph /></span>
      <span className="auth-web__node auth-web__node--four"><PeopleGlyph /></span>

      <div className="auth-web__card auth-web__card--one">
        <span>Creative</span><i /><i /><i />
      </div>
      <div className="auth-web__card auth-web__card--two">
        <span>Community</span><i /><i /><i />
      </div>
    </div>
  );
}

/* ── Slide 2: the project ────────────────────────────────────────────────── */

function ProjectArt() {
  return (
    <div className="auth-blueprint">
      <span className="auth-blueprint__grid" />
      <div className="auth-blueprint__code">
        <span /><span /><span />
        <i /><i /><i /><i />
      </div>
      <span className="auth-blueprint__node auth-blueprint__node--one" />
      <span className="auth-blueprint__node auth-blueprint__node--two" />
      <span className="auth-blueprint__node auth-blueprint__node--three" />
      <span className="auth-blueprint__link auth-blueprint__link--one" />
      <span className="auth-blueprint__link auth-blueprint__link--two" />
      <span className="auth-blueprint__chip">
        Idea
        <ArrowGlyph />
        Impact
      </span>
    </div>
  );
}

const ART = [CampusArt, CommunityArt, ProjectArt];

/* ── The panel ───────────────────────────────────────────────────────────── */

export function AuthStory({ slides, active, onSelect, onHoverChange }: AuthStoryProps) {
  const index = Math.min(active, slides.length - 1);
  const slide = slides[index];
  const Art = ART[index] ?? CampusArt;
  const carousel = slides.length > 1;

  return (
    <div
      className="auth-story"
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
    >
      <div className="auth-story__top">
        <Link className="auth-wordmark" to="/" aria-label="CNP Department, back to the home page">
          <span className="auth-wordmark__mark" aria-hidden="true">C</span>
          <span className="auth-wordmark__text">
            <span className="auth-wordmark__name">CNP Department</span>
            <span className="auth-wordmark__place">GSFC University</span>
          </span>
        </Link>
      </div>

      <div className="auth-story__copy" aria-live="off">
        <div className="auth-slide" key={index}>
          <p className="auth-eyebrow">{slide.eyebrow}</p>
          <h1 className="auth-story__title">{slide.title}</h1>
          <p className="auth-lede">{slide.body}</p>
        </div>
      </div>

      <div className="auth-art" aria-hidden="true">
        <Art />
      </div>

      <div className="auth-story__foot">
        <p className="auth-foot-note">{slide.foot}</p>
        {carousel && onSelect && (
          <div className="auth-dots" role="group" aria-label="Choose information slide">
            {slides.map((_, dot) => (
              <button
                key={dot}
                type="button"
                className={dot === index ? 'is-active' : ''}
                onClick={() => onSelect(dot)}
                aria-label={`Show slide ${dot + 1}`}
                aria-pressed={dot === index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
