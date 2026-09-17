import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Briefcase, 
  Calendar, 
  CheckSquare, 
  Archive, 
  LogOut,
  X,
  Compass
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { logout, activeRole } = useUser();

  const links = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Clubs', path: '/clubs', icon: <Users size={20} /> },
    { name: 'Events', path: '/events', icon: <CalendarDays size={20} /> },
    { name: 'Projects', path: '/projects', icon: <Briefcase size={20} /> },
    { name: 'Calendar', path: '/calendar', icon: <Calendar size={20} /> },
    // Show approvals only to Mentors and Admins
    ...(['Mentor', 'Admin'].includes(activeRole) 
      ? [{ name: 'Approvals', path: '/approvals', icon: <CheckSquare size={20} /> }] 
      : []
    ),
    { name: 'Inventory', path: '/inventory', icon: <Archive size={20} /> }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Compass size={24} style={{ color: 'var(--sky-200)' }} />
            <span>CNP PORTAL</span>
          </div>
          <button 
            className="hamburger-btn" 
            onClick={onClose}
            style={{ color: 'var(--white)', marginLeft: 'auto', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-menu">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={onClose}
              className={({ isActive }) => 
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              {link.icon}
              <span>{link.name}</span>
              {/* Subtle active state marker bar */}
              <div 
                className="active-indicator" 
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '15%',
                  bottom: '15%',
                  width: '4px',
                  backgroundColor: 'var(--navy-900)',
                  borderRadius: '0 4px 4px 0',
                  opacity: 0,
                  transition: 'opacity 0.2s ease'
                }}
              />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={logout}
            className="sidebar-link btn-hover"
            style={{ 
              width: '100%', 
              textAlign: 'left', 
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#fca5a5'
            }}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* CSS overrides to support sliding indicator and hover styling */}
      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-link.active .active-indicator {
          opacity: 1 !important;
        }
      `}} />
    </>
  );
};

export default Sidebar;
