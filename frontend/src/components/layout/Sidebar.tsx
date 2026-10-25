import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

/**
 * Destinations, one row each. `icon` is a key into NAV_ICON_PATHS (it used to hold
 * an emoji; the rendered mark is the line icon below). The shape is unchanged:
 * { id, label, icon, path, roles }.
 */
export const NAVIGATION = [
  { id: 'dashboard',     label: 'Dashboard',         icon: 'dashboard',     path: '/dashboard',         roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'clubs',         label: 'Clubs',             icon: 'clubs',         path: '/clubs',             roles: ['student', 'faculty_coordinator', 'club_admin', 'project_admin'] },
  { id: 'projects',      label: 'Projects',          icon: 'projects',      path: '/projects',          roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'events',        label: 'Events',            icon: 'events',        path: '/events',            roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'notifications', label: 'Notifications',     icon: 'notifications', path: '/notifications',     roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'inventory',     label: 'Inventory',         icon: 'inventory',     path: '/inventory',         roles: ['project_admin'] },
  { id: 'requests',      label: 'Material Requests', icon: 'requests',      path: '/material-requests', roles: ['project_admin'] },
  { id: 'profile',       label: 'Profile',           icon: 'profile',       path: '/profile',           roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] }
];

/**
 * Navigation grouped by what the person is doing, not by entity type. Order inside
 * a group is fixed by `items`; a group with nothing visible for this role is dropped.
 */
export const NAV_GROUPS: { id: string; label: string; items: string[] }[] = [
  { id: 'participate', label: 'Participate', items: ['dashboard', 'clubs', 'projects', 'events'] },
  { id: 'inbox',       label: 'Inbox',       items: ['notifications'] },
  { id: 'operations',  label: 'Operations',  items: ['inventory', 'requests'] },
  { id: 'account',     label: 'Account',     items: ['profile'] },
];

/* Line icons on the 24px grid, drawn inside a common 4–20 optical square so
   the 18px render leaves the same margin on every glyph: a wide building and a
   tall bell sit on one axis. Stroke 1.7 for the crisp rail. */
export const NAV_ICON_PATHS: Record<string, string> = {
  dashboard: 'M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5ZM13 9h7V4h-7v5Z',
  clubs: 'M4 10 12 4l8 6M6 10v8m4-8v8m4-8v8m4-8v8M4 20h16',
  projects: 'M9 5h6a1 1 0 0 1 1 1v1H8V6a1 1 0 0 1 1-1ZM5 7h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm4 4.5h6m-6 3.5h4',
  events: 'M5 6h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm-1 4.5h16M8 4v3.5m8-3.5v3.5',
  notifications: 'M17.5 10a5.5 5.5 0 0 0-11 0c0 5-2 5-2 7h15c0-2-2-2-2-7ZM10.5 20.5h3',
  inventory: 'm4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4m8-12v8l-8 4m0-8v8',
  requests: 'M4 13h4l1.5 3h5L16 13h4M4 13V6.5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1V13M4 13v4.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V13',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
};

export function NavIcon({ id, className = 'rail-icon' }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d={NAV_ICON_PATHS[id]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  faculty_coordinator: 'Faculty coordinator',
  faculty_mentor: 'Faculty mentor',
  club_admin: 'Club admin',
  project_admin: 'Project admin',
};

export function roleLabel(role?: string): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

interface SidebarProps {
  /** Present only when the rail is an off-canvas drawer; renders the close control. */
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  if (!user) return null;

  // After signing out, go to the public landing page (not the login form).
  const handleSignOut = () => {
    navigate('/', { replace: true });
    logout();
  };

  const visible = NAVIGATION.filter((item) => item.roles.includes(user.role));
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    entries: visible.filter((item) => group.items.includes(item.id)),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="rail">
      <div className="rail-head">
        <Link className="rail-brand" to="/dashboard" aria-label="CNP Department, open dashboard">
          <span className="shell-mark" aria-hidden="true">C</span>
          <span className="rail-brand__text">
            <span className="rail-brand__name">CNP Department</span>
            <span className="rail-brand__place">GSFC University</span>
          </span>
        </Link>

        {onClose && (
          <button type="button" className="rail-close" onClick={onClose} aria-label="Close navigation">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <nav className="rail-nav" aria-label="Main">
        {groups.map((group) => (
          <div className="rail-group" key={group.id}>
            <p className="rail-group__label" id={`rail-group-${group.id}`}>{group.label}</p>
            <ul className="rail-list" aria-labelledby={`rail-group-${group.id}`}>
              {group.entries.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `rail-link${isActive ? ' is-active' : ''}`}
                  >
                    <NavIcon id={item.id} />
                    <span className="rail-link__label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="rail-foot">
        <div className="rail-user">
          {user.profileImage ? (
            <span className="rail-avatar">
              <img src={user.profileImage} alt="" decoding="async" />
            </span>
          ) : (
            <span className="rail-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
          )}
          <span className="rail-user__text">
            <span className="rail-user__name" title={user.name}>{user.name}</span>
            <span className="rail-role">{roleLabel(user.role)}</span>
          </span>
        </div>

        {/* Appearance is a preference, not a destination: it lives with the
            account row, remembers the choice, and never follows the device. */}
        <button
          type="button"
          className="rail-theme"
          role="switch"
          aria-checked={isDark}
          aria-label="Dark mode"
          title={isDark ? 'Switch to light' : 'Switch to dark'}
          onClick={toggleTheme}
        >
          <span className="rail-theme__glyph" aria-hidden="true">
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="none" focusable="false">
                <path
                  d="M20 14.2A8 8 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" focusable="false">
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <span className="rail-theme__label">{isDark ? 'Dark' : 'Light'}</span>
          <span className="rail-theme__track" aria-hidden="true">
            <span className="rail-theme__knob" />
          </span>
        </button>

        <button type="button" className="rail-signout" onClick={handleSignOut}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path
              d="M15 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8M14 12h7m-3-3 3 3-3 3"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
}
