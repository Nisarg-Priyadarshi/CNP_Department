import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [joinStatus, setJoinStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await api<any>('GET', `/projects`).then(res => res.data.find((x: any) => x._id === id));
        if (!p) throw new Error("Not found");
        setProject(p);
        
        const mems = await api<any>('GET', `/projects/${id}/members`).then(res => res.data);
        setMembers(mems);
        
        if (user?.role === 'student') {
          const reqs = await api<any>('GET', '/join-requests/student').then(res => res.data);
          const isMember = mems.some((m: any) => m.studentId._id === user._id);
          const hasPending = reqs.some((r: any) => r.projectId?._id === id && r.status === 'pending');
          if (isMember) setJoinStatus('member');
          else if (hasPending) setJoinStatus('pending');
          else setJoinStatus('none');
        }
      } catch (e) {
        navigate('/projects');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user, navigate]);

  const handleJoin = async () => {
    try {
      await api('POST', `/projects/${id}/join`);
      setJoinStatus('pending');
      alert('Join request sent successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to join');
    }
  };

  if (loading) return <div className="spinner"></div>;
  if (!project) return null;

  const isTL = (m: any) => typeof project.teamLeaderId === 'object' ? project.teamLeaderId?._id === m.studentId._id : project.teamLeaderId === m.studentId._id;

  return (
    <div>
      <button className="btn btn-sm btn-outline" style={{ marginBottom: '16px' }} onClick={() => navigate('/projects')}>← Back</button>
      <div className="card">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {project.image ? <img src={project.image} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} /> : null}
            <div>
              <h2 style={{ margin: 0 }}>{project.name}</h2>
              <div style={{ color: 'var(--text-faint)', marginTop: '4px' }}>Status: {project.status}</div>
            </div>
          </div>
          {user?.role === 'student' && (
            joinStatus === 'member' ? <span className="badge badge-student" style={{ padding: '8px 16px' }}>✅ Member</span>
            : joinStatus === 'pending' ? <span className="badge" style={{ background: '#f59e0b', color: 'white', padding: '8px 16px' }}>⏳ Request Pending</span>
            : <button className="btn btn-primary" onClick={handleJoin}>Join Project</button>
          )}
        </div>
        <div className="card-body"><p>{project.description}</p></div>
      </div>
      
      <div className="card">
        <div className="card-title">Project Team</div>
        <div className="card-body">
          {members.length ? members.map(m => (
            <div key={m._id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {m.studentId.profileImage ? <img src={m.studentId.profileImage} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eee' }}></div>}
                <div style={{ fontWeight: 500 }}>{m.studentId.name}</div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>
                {isTL(m) ? 'Team Leader' : 'Team Member'}
              </div>
            </div>
          )) : <div className="empty-state">No members yet.</div>}
        </div>
      </div>
    </div>
  );
}
