import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface LandingHeroProps {
  signedIn: boolean;
}

const SCREENS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    src: '/screens/dashboard.webp',
    alt: 'The CNP Department student dashboard: clubs joined, upcoming club events and unread notifications.',
    caption: 'Clubs, projects and the next club events, on one student dashboard.',
  },
  {
    id: 'clubs',
    label: 'Clubs',
    src: '/screens/clubs.webp',
    alt: 'The clubs directory, listing each Student Managed Club with its faculty coordinator.',
    caption: 'Every club, its members and its faculty coordinator in one directory.',
  },
  {
    id: 'projects',
    label: 'Projects',
    src: '/screens/projects.webp',
    alt: 'The projects hub, listing active projects with their status and team leader.',
    caption: 'Active projects with their status and the student leading each team.',
  },
];

/**
 * Stage: the words on five columns, the product on seven. The frame's own tab bar
 * switches between the three views a student actually sees.
 */
export function LandingHero({ signedIn }: LandingHeroProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    SCREENS.forEach((screen) => {
      const image = new Image();
      image.src = screen.src;
    });
  }, []);

  useEffect(() => {
    if (paused || held) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % SCREENS.length), 6400);
    return () => window.clearInterval(timer);
  }, [paused, held]);

  const screen = SCREENS[active];

  return (
    <section className="landing-hero" id="top">
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <h1>Welcome to the CNP Department</h1>
          <p className="landing-hero-line">Clubs and projects, organised, resourced and seen.</p>
          <div className="landing-hero-actions">
            <Link className="key key--primary" to={signedIn ? '/dashboard' : '/login'}>
              {signedIn ? 'Open dashboard' : 'Log in'}
            </Link>
            <a className="key key--quiet" href="#clubs">
              See what&rsquo;s inside
            </a>
          </div>
        </div>

        <div
          className="landing-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="landing-stage-frame">
            <div className="landing-stage-bar">
              <div className="landing-stage-tabs" role="tablist" aria-label="Product views">
                {SCREENS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    id={`stage-tab-${s.id}`}
                    aria-selected={i === active}
                    aria-controls="stage-view"
                    tabIndex={i === active ? 0 : -1}
                    className={`landing-stage-tab${i === active ? ' is-active' : ''}`}
                    onClick={() => setActive(i)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="landing-stage-role">Student view</span>
              <button
                type="button"
                className="landing-stage-hold"
                aria-pressed={held}
                onClick={() => setHeld((value) => !value)}
              >
                {held ? 'Play' : 'Pause'}
                <span className="visually-hidden"> the view rotation</span>
              </button>
            </div>

            <div className="landing-stage-view" id="stage-view" role="tabpanel" aria-labelledby={`stage-tab-${screen.id}`}>
              <img
                key={screen.id}
                className="landing-stage-img"
                src={screen.src}
                alt={screen.alt}
                width={1440}
                height={900}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <span className="landing-stage-corner" aria-hidden="true" />
            </div>

            <div className="landing-stage-foot">
              <p className="landing-stage-caption" aria-live="polite">{screen.caption}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
