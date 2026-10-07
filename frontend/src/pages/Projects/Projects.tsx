import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api<any>('GET', '/projects').then(res => {
      setProjects(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="section-title">📋 Projects</h2>
      {loading ? <div className="spinner"></div> : (
        projects.length ? (
          <div>
            {projects.map(p => {
              const tlObj = typeof p.teamLeaderId === 'object' ? p.teamLeaderId : null;
              return (
              <div key={p._id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p._id}`)}>
                <div className="card-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {p.image ? <img src={p.image} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} /> : null}
                  <div>
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                    <span className="badge" style={{ fontSize: '10px', marginTop: '4px', display: 'inline-block' }}>{p.status}</span>
                    {tlObj ? <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>Team Leader: {tlObj.name}</div> : null}
                  </div>
                </div>
                <div className="card-body">
                  <p style={{ color: 'var(--text-faint)', fontSize: '14px', margin: 0 }}>{p.description}</p>
                </div>
              </div>
            )})}
          </div>
        ) : <div className="empty-state">No projects available.</div>
      )}
    </div>
  );
}
