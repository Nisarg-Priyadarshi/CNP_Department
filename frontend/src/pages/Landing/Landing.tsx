import { useAuth } from '../../context/AuthContext';
import { LandingNav } from '../../components/landing/LandingNav';
import { LandingHero } from '../../components/landing/LandingHero';
import { LandingSections } from '../../components/landing/LandingSections';
import { LandingClose } from '../../components/landing/LandingClose';
import { LandingFooter } from '../../components/landing/LandingFooter';

/**
 * Public front page at "/". Everyone, signed in or not, reads the same page; only
 * the action changes (Log in vs Open dashboard).
 */
export default function Landing() {
  const { user } = useAuth();
  const signedIn = !!user;

  return (
    <div className="landing">
      <LandingNav signedIn={signedIn} />
      <main id="content">
        <LandingHero signedIn={signedIn} />
        <LandingSections />
        <LandingClose signedIn={signedIn} />
      </main>
      <LandingFooter />
    </div>
  );
}
