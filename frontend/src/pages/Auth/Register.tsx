import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const ALLOWED_ROLES = [
  { value: 'student',             label: 'Student' },
  { value: 'faculty_coordinator', label: 'Faculty Coordinator' },
  { value: 'faculty_mentor',      label: 'Faculty Mentor' },
  { value: 'club_admin',          label: 'Club Admin' },
  { value: 'project_admin',       label: 'Project Admin' },
];

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: '', department: '', universityId: '', phone: '', bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name || !formData.email || !formData.password || !formData.role) {
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
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <div className="dot"></div>
          <span>CNP Department</span>
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Join the Student Clubs & Projects portal</p>
        
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-grid">
            <div className="auth-field">
              <label>Full Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="auth-field">
              <label>Email *</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            </div>
            <div className="auth-field">
              <label>Password *</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={8} />
            </div>
            <div className="auth-field">
              <label>Role *</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} required>
                <option value="">— Select your role —</option>
                {ALLOWED_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="auth-field">
              <label>Department</label>
              <input type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
            </div>
            <div className="auth-field">
              <label>University ID</label>
              <input type="text" value={formData.universityId} onChange={e => setFormData({...formData, universityId: e.target.value})} />
            </div>
            <div className="auth-field">
              <label>Phone</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="auth-field auth-field-full">
              <label>Bio</label>
              <textarea rows={2} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
