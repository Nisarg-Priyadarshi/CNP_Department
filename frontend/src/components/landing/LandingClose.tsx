import { Link } from 'react-router-dom';

interface LandingCloseProps {
  signedIn: boolean;
}

/** The page closes on the one thing a visitor came to do: sign in. */
export function LandingClose({ signedIn }: LandingCloseProps) {
  return (
    <section className="landing-close">
      <div className="landing-container landing-close-inner">
        <div className="landing-close-copy">
          <h2>Sign in to manage your club, project or team.</h2>
        </div>

        <div className="landing-close-action">
          <Link className="key key--primary key--lg" to={signedIn ? '/dashboard' : '/login'}>
            {signedIn ? 'Open dashboard' : 'Log in'}
          </Link>
          <p className="landing-close-note">One sign-in for students, faculty and administrators.</p>
        </div>
      </div>
    </section>
  );
}
