import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <h2 className="section-title">👤 Profile</h2>
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
            {user.profileImage ? (
              <img src={user.profileImage} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#eee' }}></div>
            )}
            <div>
              <h2 style={{ margin: '0 0 8px 0' }}>{user.name}</h2>
              <span className="badge" style={{ fontSize: '14px' }}>{user.role}</span>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-faint)' }}>Email</strong>{user.email}</div>
            {user.universityId && <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-faint)' }}>University ID</strong>{user.universityId}</div>}
            {user.department && <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-faint)' }}>Department</strong>{user.department}</div>}
            {user.phone && <div><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-faint)' }}>Phone</strong>{user.phone}</div>}
            {user.bio && <div style={{ gridColumn: 'span 2' }}><strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-faint)' }}>Bio</strong>{user.bio}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
