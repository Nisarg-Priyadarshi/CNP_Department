import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Menu, ShieldAlert, User } from 'lucide-react';
import Avatar from './Avatar';

const Header = ({ onMenuToggle }) => {
  const { currentUser, activeRole, changeActiveRole } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine page title based on path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard Overview';
    if (path.startsWith('/clubs')) return 'Clubs & Chapters';
    if (path.startsWith('/events')) return 'Department Events';
    if (path.startsWith('/projects')) return 'Student Projects';
    if (path.startsWith('/calendar')) return 'Event Calendar';
    if (path.startsWith('/approvals')) return 'Approval Requests';
    if (path.startsWith('/inventory')) return 'Equipment Inventory';
    if (path.startsWith('/profile/')) return 'Student Profile';
    if (path.startsWith('/profile')) return 'My Profile';
    if (path.startsWith('/club/')) return 'Club Profile';
    return 'CNP Department';
  };

  const handleRoleChange = (e) => {
    changeActiveRole(e.target.value);
  };

  if (!currentUser) return null;

  return (
    <header className="app-header">
      <div className="header-title-container">
        <button 
          className="hamburger-btn btn-hover" 
          onClick={onMenuToggle}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Menu size={24} />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--navy-900)' }}>
          {getPageTitle()}
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Role Switcher for simulation testing */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            padding: '0.375rem 0.75rem',
            backgroundColor: 'var(--sky-50)',
            border: '1px solid var(--sky-200)',
            borderRadius: '0.5rem'
          }}
        >
          <ShieldAlert size={16} style={{ color: 'var(--navy-800)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--navy-900)' }}>
            Simulate Role:
          </span>
          <select
            value={activeRole}
            onChange={handleRoleChange}
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--navy-900)',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="Student">Student</option>
            <option value="Office Bearer">Office Bearer</option>
            <option value="Mentor">Mentor</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        {/* Profile Navigation */}
        <Link 
          to="/profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.5rem',
            transition: 'background-color 0.2s ease'
          }}
          className="row-hover"
        >
          <div style={{ textAlign: 'right', display: 'none', md: 'block' }} className="user-details-text">
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dark)' }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {activeRole}
            </div>
          </div>
          <Avatar name={currentUser.name} size="sm" />
        </Link>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 769px) {
          .user-details-text {
            display: block !important;
          }
        }
      `}} />
    </header>
  );
};

export default Header;
