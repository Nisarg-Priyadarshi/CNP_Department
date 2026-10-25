import { Link } from 'react-router-dom';
import { LANDING_LINKS } from './landingLinks';

interface LandingNavProps {
  signedIn: boolean;
}

/**
 * Slab: one heavy graphite bar, edge to edge. Wordmark and place at the left, the
 * page's four destinations at the right, one cobalt key for the way in.
 */
export function LandingNav({ signedIn }: LandingNavProps) {
  return (
    <header className="landing-nav">
      <div className="landing-nav-inner landing-container">
        <a className="landing-brand" href="#top" aria-label="CNP Department home">
          <span className="landing-brand-mark" aria-hidden="true">C</span>
          <span className="landing-brand-name">CNP Department</span>
          <span className="landing-brand-place">GSFC University</span>
        </a>

        <nav className="landing-nav-links" aria-label="Sections">
          {LANDING_LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>

        <Link className="key key--primary key--sm landing-nav-key" to={signedIn ? '/dashboard' : '/login'}>
          {signedIn ? 'Open dashboard' : 'Log in'}
        </Link>
      </div>
      <span className="landing-nav-progress" aria-hidden="true" />
    </header>
  );
}
