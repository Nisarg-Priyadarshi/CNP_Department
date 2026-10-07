import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any>('GET', '/events/upcoming').then(res => {
      setEvents(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="section-title">📅 Events</h2>
      {loading ? <div className="spinner"></div> : (
        events.length ? (
          <div>
            {events.map(e => (
              <div key={e._id} className="card">
                <div className="card-header"><h3 style={{ margin: 0 }}>{e.title}</h3></div>
                <div className="card-body">
                  <div style={{ color: 'var(--text-faint)', fontSize: '12px', marginBottom: '8px' }}>
                    {new Date(e.date).toLocaleString()} • {e.location}
                  </div>
                  <p style={{ margin: 0 }}>{e.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">No upcoming events.</div>
      )}
    </div>
  );
}
