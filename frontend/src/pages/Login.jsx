import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Compass, Mail, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import Avatar from '../components/Avatar';

const Login = () => {
  const { login, currentUser } = useUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123'); // Preset password for ease
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter a mock email address.');
      return;
    }

    const res = login(email, password);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 800);
    } else {
      setError(res.message);
    }
  };

  const fillCredentials = (mockEmail) => {
    setEmail(mockEmail);
    setPassword('password123');
  };

  return (
    <div 
      className="page-enter"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-850, #172554) 100%)',
        padding: '1.5rem'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '450px',
          backgroundColor: 'var(--white)',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          padding: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* CNP Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Compass size={32} style={{ color: 'var(--navy-900)' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy-900)', letterSpacing: '0.05em' }}>
            CNP PORTAL
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem', textAlign: 'center' }}>
          Clubs & Projects Department
        </p>

        {/* Circular Profile Avatar graphic with dynamic initials */}
        <Avatar name={email || 'CNP'} size="lg" style={{ marginBottom: '1.5rem' }} />

        {error && (
          <div 
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'start',
              gap: '0.5rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#991b1b',
              fontSize: '0.85rem'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div 
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#d1fae5',
              border: '1px solid #6ee7b7',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#065f46',
              fontSize: '0.85rem'
            }}
          >
            <CheckCircle size={16} />
            <span>Login successful! Loading dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '1rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)' 
                }} 
              />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="student@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '1rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)' 
                }} 
              />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                required
              />
            </div>
          </div>

          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              fontSize: '0.85rem',
              marginBottom: '1.5rem' 
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--navy-900)' }}
              />
              <span style={{ color: 'var(--text-dark)' }}>Remember me</span>
            </label>
            <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Mock Feature: Reset link has been sent to your email!"); }} style={{ color: 'var(--navy-800)', fontWeight: 600 }}>
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            className="btn-hover"
            style={{
              width: '100%',
              padding: '0.85rem',
              backgroundColor: 'var(--navy-900)',
              color: 'var(--white)',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(23, 37, 84, 0.2)'
            }}
          >
            Sign In
          </button>
        </form>

        {/* Mock accounts helper block */}
        <div 
          style={{
            marginTop: '2rem',
            width: '100%',
            padding: '1rem',
            backgroundColor: 'var(--off-white)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-900)', marginBottom: '0.5rem' }}>
            TEST CREDENTIALS (CLICK TO AUTOFILL):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <button 
              type="button"
              onClick={() => fillCredentials('vedant@college.edu')}
              style={{ fontSize: '0.75rem', textAlign: 'left', color: 'var(--text-dark)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--white)' }}
            >
              💼 <strong>Admin:</strong> vedant@college.edu
            </button>
            <button 
              type="button"
              onClick={() => fillCredentials('priya.patel@college.edu')}
              style={{ fontSize: '0.75rem', textAlign: 'left', color: 'var(--text-dark)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--white)' }}
            >
              🎓 <strong>Office Bearer:</strong> priya.patel@college.edu
            </button>
            <button 
              type="button"
              onClick={() => fillCredentials('r.verma@college.edu')}
              style={{ fontSize: '0.75rem', textAlign: 'left', color: 'var(--text-dark)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--white)' }}
            >
              👨‍🏫 <strong>Mentor:</strong> r.verma@college.edu
            </button>
            <button 
              type="button"
              onClick={() => fillCredentials('sneha.reddy@college.edu')}
              style={{ fontSize: '0.75rem', textAlign: 'left', color: 'var(--text-dark)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--white)' }}
            >
              👤 <strong>Student:</strong> sneha.reddy@college.edu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
