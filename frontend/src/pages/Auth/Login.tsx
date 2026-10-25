import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AuthStory, type AuthSlide } from './AuthStory';
import './auth.css';

const SLIDES: AuthSlide[] = [
  {
    eyebrow: <>Student clubs <span className="auth-eyebrow__sep" aria-hidden="true">/</span> GUIITAR projects</>,
    title: <>Your campus work,<br />connected.</>,
    body: 'Access student-managed clubs and GUIITAR projects through one college platform.',
    foot: 'For authorized students, faculty, and college officials',
  },
  {
    eyebrow: 'Student managed clubs',
    title: <>Find your people.<br />Build your community.</>,
    body: 'Discover student clubs, connect with members, and explore opportunities to participate in campus activities.',
    foot: 'Student communities. Shared interests. Real connections.',
  },
  {
    eyebrow: 'GUIITAR projects',
    title: <>Ideas into<br />real-world projects.</>,
    body: 'Explore student-built projects, discover creative work, and connect with the innovation happening across campus.',
    foot: 'Built by students. Driven by ideas.',
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isStoryHovered, setIsStoryHovered] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isStoryHovered) return;

    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % 3);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [activeSlide, isStoryHovered]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || isSubmittingRef.current) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email address and password to continue.');
      return;
    }

    setError('');
    setLoading(true);
    isSubmittingRef.current = true;

    try {
      const response = await api<any>('POST', '/auth/login', {
        email: trimmedEmail,
        password,
      });

      if (response.success && response.token && response.user) {
        login(response.token, response.user);

        const from = (location.state as any)?.from?.pathname;
        const target =
          from && from !== '/login'
            ? from
            : isProfileComplete(response.user)
              ? '/dashboard'
              : '/profile';

        navigate(target, { replace: true });
      } else {
        setError(response.message || 'Login failed. Check your details and try again.');
        setLoading(false);
        isSubmittingRef.current = false;
      }
    } catch (requestError: any) {
      setError(requestError.message || 'We couldn’t sign you in. Please try again.');
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <main className="auth-gate">
      <section className="auth-shell" aria-label="CNP Department sign in">
        <AuthStory
          slides={SLIDES}
          active={activeSlide}
          onSelect={setActiveSlide}
          onHoverChange={setIsStoryHovered}
        />

        <div className="auth-panel">
          <div className="auth-panel__inner">
            <header className="auth-head">
              <h2 className="auth-head__title">Welcome back</h2>
              <p className="auth-head__sub">Sign in with your authorized college account.</p>
            </header>

            {error && <div className="auth-alert" id="login-error" role="alert">{error}</div>}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-line">
                <label className="ui-label" htmlFor="login-email">College email</label>
                <div className="auth-input">
                  <svg className="auth-input__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                    <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" />
                    <path d="m4.4 7.2 7.6 6 7.6-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                  <input
                    id="login-email"
                    name="email"
                    className="ui-field auth-input__field"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="name@college.edu"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    disabled={loading}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </div>
              </div>

              <div className="auth-line">
                <label className="ui-label" htmlFor="login-password">Password</label>
                <div className="auth-input auth-input--action">
                  <svg className="auth-input__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                    <path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <rect x="4.5" y="11" width="15" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 14.6v2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <input
                    id="login-password"
                    name="password"
                    className="ui-field auth-input__field"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    disabled={loading}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    className="auth-reveal"
                    type="button"
                    onClick={() => setShowPassword(visible => !visible)}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path d="M2.6 12S6.2 6.4 12 6.4 21.4 12 21.4 12 17.8 17.6 12 17.6 2.6 12 2.6 12Z" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.6" />
                        <path d="m4.5 4.5 15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path d="M2.6 12S6.2 6.4 12 6.4 21.4 12 21.4 12 17.8 17.6 12 17.6 2.6 12 2.6 12Z" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block auth-go" type="submit" disabled={loading}>
                {loading ? (
                  <><span className="auth-spinner" aria-hidden="true" />Signing in…</>
                ) : (
                  <>Sign in <span className="auth-go__arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" focusable="false">
                      <path d="M5 12h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span></>
                )}
              </button>

              <p className="auth-note">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                  <path d="M12 3.6 19 6v6c0 4.1-3 6.7-7 8.4-4-1.7-7-4.3-7-8.4V6l7-2.4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                Access is limited to authorized college accounts
              </p>
            </form>
          </div>

          <p className="auth-foot-line">
            CNP Department <span aria-hidden="true">·</span> Student managed clubs &amp; GUIITAR
          </p>
        </div>
      </section>
    </main>
  );
}
