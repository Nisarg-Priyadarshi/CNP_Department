import { LANDING_LINKS } from './landingLinks';

/** Colophon: who the page belongs to, its sections, and the way back to the top. */
export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <p className="landing-colophon">
          <span className="landing-colophon-name">CNP Department</span> · GSFC University, Vadodara.
          Student Managed Clubs and GUIITAR Projects, run in one place.
        </p>

        <div className="landing-footer-rail">
          <nav className="landing-footer-links" aria-label="Sections">
            {LANDING_LINKS.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </nav>
          <a className="landing-top" href="#top">
            Back to top<span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
