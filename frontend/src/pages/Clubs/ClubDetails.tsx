import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ClubDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [club, setClub] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [joinStatus, setJoinStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await api<any>('GET', `/clubs`).then(res => res.data.find((x: any) => x._id === id));
        if (!c) throw new Error("Not found");
        setClub(c);
        
        const mems = await api<any>('GET', `/clubs/${id}/members`).then(res => res.data);
        setMembers(mems);
        
        if (user?.role === 'student') {
          const reqs = await api<any>('GET', '/join-requests/student').then(res => res.data);
          const isMember = mems.some((m: any) => m.studentId._id === user._id);
          const hasPending = reqs.some((r: any) => r.clubId?._id === id && r.status === 'pending');
          if (isMember) setJoinStatus('member');
          else if (hasPending) setJoinStatus('pending');
          else setJoinStatus('none');
        }
      } catch (e) {
        navigate('/clubs');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user, navigate]);

  const handleJoin = async () => {
    try {
      await api('POST', `/clubs/${id}/join`);
      setJoinStatus('pending');
      alert('Join request sent successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to join');
    }
  };

  if (loading) return <div className="spinner"></div>;
  if (!club) return null;

  return (
    <div>
      <button className="btn btn-sm btn-outline" style={{ marginBottom: '16px' }} onClick={() => navigate('/clubs')}>← Back</button>
      <div className="card">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>{club.name}</h2>
            <div style={{ color: 'var(--text-faint)', marginTop: '4px' }}>
              Faculty Coordinator: {typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId?.name : (club.facultyCoordinatorId || 'None')}
            </div>
          </div>
          {user?.role === 'student' && (
            joinStatus === 'member' ? <span className="badge badge-student" style={{ padding: '8px 16px' }}>✅ Member</span>
            : joinStatus === 'pending' ? <span className="badge" style={{ background: '#f59e0b', color: 'white', padding: '8px 16px' }}>⏳ Request Pending</span>
            : <button className="btn btn-primary" onClick={handleJoin}>Join Club</button>
          )}
        </div>
        <div className="card-body"><p>{club.description}</p></div>
      </div>
      
      <div className="card">
        <div className="card-title">Members & Core Team</div>
        <div className="card-body">
          {members.length ? members.map(m => (
            <div key={m._id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
              <div style={{ fontWeight: 500 }}>{m.studentId.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                {m.membershipType === 'core_team' ? `Core Team (${m.position || '-'}) ` : 'Member'}
              </div>
            </div>
          )) : <div className="empty-state">No members yet.</div>}
        </div>
      </div>
    </div>
  );
}
