import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myClubs, setMyClubs] = useState<any[]>([]);
  const [myProjects, setMyProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'student') {
      const load = async () => {
        try {
          const [clubs, projects] = await Promise.all([
            api<any>('GET', '/clubs').then(res => res.data),
            api<any>('GET', `/users/${user._id}/projects`).then(res => res.data.map((d: any) => d.project))
          ]);
          
          const memberships = [];
          for (const c of clubs) {
            const mems = await api<any>('GET', `/clubs/${c._id}/members`).then(res => res.data);
            const me = mems.find((m: any) => m.studentId._id === user._id);
            if (me) memberships.push({ club: c, membership: me });
          }
          setMyClubs(memberships);
          setMyProjects(projects);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      load();
    } else {
      setLoading(false);
    }
  }, [user]);

  return (
    <div>
      <h2 className="section-title">📊 Dashboard</h2>
      <p className="section-sub">Welcome back, {user?.name}</p>
      
      {user?.role === 'student' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <div className="card-title">Club Memberships</div>
            <div className="card-body">
              {loading ? <div className="spinner"></div> : myClubs.length ? myClubs.map(mc => (
                <div key={mc.club._id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{mc.club.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                      {mc.membership.membershipType === 'core_team' ? `Core Team (${mc.membership.position || 'Member'})` : 'Member'}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={() => navigate(`/clubs/${mc.club._id}`)}>View</button>
                </div>
              )) : <div className="empty-state">Not a member of any clubs yet.</div>}
            </div>
          </div>
          
          <div className="card">
            <div className="card-title">Project Memberships</div>
            <div className="card-body">
              {loading ? <div className="spinner"></div> : myProjects.length ? myProjects.map(p => {
                const isTL = typeof p.teamLeaderId === 'object' ? p.teamLeaderId?._id === user._id : p.teamLeaderId === user._id;
                return (
                <div key={p._id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                      Status: {p.status} | Role: {isTL ? 'Team Leader' : 'Team Member'}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={() => navigate(`/projects/${p._id}`)}>View</button>
                </div>
              )
              }) : <div className="empty-state">Not assigned to any projects yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
