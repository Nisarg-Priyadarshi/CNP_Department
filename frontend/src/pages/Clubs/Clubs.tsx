import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function Clubs() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api<any>('GET', '/clubs').then(res => {
      setClubs(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="section-title">🏛 Clubs</h2>
      {loading ? <div className="spinner"></div> : (
        clubs.length ? (
          <div>
            {clubs.map(c => (
              <div key={c._id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/clubs/${c._id}`)}>
                <div className="card-header"><h3 style={{ margin: 0 }}>{c.name}</h3></div>
                <div className="card-body">
                  <p style={{ color: 'var(--text-faint)', fontSize: '14px', margin: 0 }}>{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">No clubs available.</div>
      )}
    </div>
  );
}
