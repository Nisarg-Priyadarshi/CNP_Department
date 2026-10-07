import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const NAVIGATION = [
  { id: 'dashboard',     label: 'Dashboard',         icon: '📊', path: '/dashboard',         roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'clubs',         label: 'Clubs',             icon: '🏛', path: '/clubs',             roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'projects',      label: 'Projects',          icon: '📋', path: '/projects',          roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'events',        label: 'Events',            icon: '📅', path: '/events',            roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'notifications', label: 'Notifications',     icon: '🔔', path: '/notifications',     roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'inventory',     label: 'Inventory',         icon: '📦', path: '/inventory',         roles: ['project_admin'] },
  { id: 'requests',      label: 'Material Requests', icon: '🛒', path: '/material-requests', roles: ['project_admin'] },
  { id: 'profile',       label: 'Profile',           icon: '👤', path: '/profile',           roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] }
];

export function Sidebar() {
  const { user, logout } = useAuth();
  
  if (!user) return null;

  return (
    <nav className="main-sidebar">
      <div className="brand">
        <div className="dot"></div>
        <span>CNP Portal</span>
      </div>
      
      <div className="nav-links">
        {NAVIGATION.filter(nav => nav.roles.includes(user.role)).map(nav => (
          <NavLink
            key={nav.id}
            to={nav.path}
            className={({ isActive }) => `main-nav-btn ${isActive ? 'active' : ''}`}
          >
            <span className="icon">{nav.icon}</span> {nav.label}
          </NavLink>
        ))}
      </div>

      <div className="user-indicator">
        <div className="user-info">
          {user.profileImage ? (
            <img src={user.profileImage} alt="Profile" className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder"></div>
          )}
          <div className="user-meta">
            <span className="user-name" title={user.name}>{user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>
        </div>
        <button className="btn btn-sm" onClick={logout} style={{ width: '100%' }}>Sign Out</button>
      </div>
    </nav>
  );
}
