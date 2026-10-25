import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AuthStory, type AuthSlide } from './AuthStory';
import './auth.css';

const SLIDES: AuthSlide[] = [
  {
    eyebrow: 'New account',
    title: <>Join the work<br />on campus.</>,
    body: 'Student-managed clubs and GUIITAR projects, in one place.',
    foot: 'For authorized students, faculty, and college officials',
  },
];

export default function Register() {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'student', department: '', universityId: '', phone: '', bio: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = { ...formData };
      ['department', 'universityId', 'phone', 'bio'].forEach(k => {
        if (!payload[k]) delete payload[k];
      });

      const res = await api<any>('POST', '/auth/register', payload);
      if (res.success && res.token && res.user) {
        login(res.token, res.user);
      } else {
        setError(res.message || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-gate">
      <section className="auth-shell auth-shell--wide" aria-label="CNP Department create account">
        <AuthStory slides={SLIDES} active={0} />

        <div className="auth-panel">
          <div className="auth-panel__inner">
            <header className="auth-head">
              <h2 className="auth-head__title">Create your account</h2>
              <p className="auth-head__sub">Join the Student Clubs &amp; Projects portal.</p>
            </header>

            {error && <div className="auth-alert" id="register-error" role="alert">{error}</div>}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-fields">
                <div className="auth-line">
                  <label className="ui-label" htmlFor="register-name">
                    Full name <span className="auth-req" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="register-name"
                    className="ui-field auth-input__field"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'register-error' : undefined}
                  />
                </div>

                <div className="auth-line">
                  <label className="ui-label" htmlFor="register-email">
                    Email <span className="auth-req" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="register-email"
                    className="ui-field auth-input__field"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    disabled={loading}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'register-error' : undefined}
                  />
                </div>

                <div className="auth-line">
                  <label className="ui-label" htmlFor="register-password">
                    Password <span className="auth-req" aria-hidden="true">*</span>
                  </label>
                  <div className="auth-input auth-input--action">
                    <input
                      id="register-password"
                      className="ui-field auth-input__field"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      disabled={loading}
                      required
                      minLength={8}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'register-error' : undefined}
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

                <div className="auth-line">
                  <span className="ui-label">Account type</span>
                  <p className="auth-fixed">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                      <path d="M12 3 3 7l9 4 9-4-9-4Zm-9 8v4l9 4 9-4v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Student
                  </p>
                  <p className="ui-hint">
                    Faculty and administrator accounts are provisioned by the department.
                  </p>
                </div>

                <div className="auth-line">
                  <label className="ui-label" htmlFor="register-department">Department</label>
                  <input
                    id="register-department"
                    className="ui-field auth-input__field"
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="auth-line">
                  <label className="ui-label" htmlFor="register-university-id">University ID</label>
                  <input
                    id="register-university-id"
                    className="ui-field auth-input__field"
                    type="text"
                    value={formData.universityId}
                    onChange={e => setFormData({ ...formData, universityId: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="auth-line">
                  <label className="ui-label" htmlFor="register-phone">Phone</label>
                  <input
                    id="register-phone"
                    className="ui-field auth-input__field"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="auth-line auth-line--full">
                  <label className="ui-label" htmlFor="register-bio">Bio</label>
                  <textarea
                    id="register-bio"
                    className="ui-field ui-field--area auth-input__field"
                    rows={3}
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>

              <button className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block auth-go" type="submit" disabled={loading}>
                {loading ? <><span className="auth-spinner" aria-hidden="true" />Creating account…</> : 'Create account'}
              </button>
            </form>

            <p className="auth-alt">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>

          <p className="auth-foot-line">
            CNP Department <span aria-hidden="true">·</span> Student managed clubs &amp; GUIITAR
          </p>
        </div>
      </section>
    </main>
  );
}
