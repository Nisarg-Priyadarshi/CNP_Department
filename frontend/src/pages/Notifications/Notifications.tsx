import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any>('GET', '/notifications').then(res => {
      setNotifications(res.data);
      setLoading(false);
    });
  }, []);

  const markRead = async (id: string) => {
    try {
      await api('PATCH', `/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  return (
    <div>
      <h2 className="section-title">🔔 Notifications</h2>
      {loading ? <div className="spinner"></div> : (
        notifications.length ? (
          <div>
            {notifications.map(n => (
              <div key={n._id} className="card" style={{ opacity: n.isRead ? 0.7 : 1 }}>
                <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>{n.title}</h4>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-faint)' }}>{n.message}</p>
                  </div>
                  {!n.isRead && <button className="btn btn-sm btn-outline" onClick={() => markRead(n._id)}>Mark Read</button>}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">No notifications.</div>
      )}
    </div>
  );
}
