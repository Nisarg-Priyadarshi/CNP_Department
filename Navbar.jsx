import React from 'react';
import {
  Menu,
  CalendarDays,
  Landmark,
  FolderKanban,
  CalendarRange,
  CheckSquare,
  Package,
} from './Icons';
import './Navbar.css';

const NAV_ITEMS = [
  { label: 'Events', icon: CalendarDays },
  { label: 'Clubs', icon: Landmark },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Calendar', icon: CalendarRange },
  { label: 'Approvals', icon: CheckSquare },
  { label: 'Inventory', icon: Package },
];

/**
 * Top navigation bar.
 *
 * Props:
 *  - onMenuClick(): called when the hamburger icon is clicked (opens the sidebar)
 *  - activeItem: string, the currently selected nav label
 *  - onNavClick(label): called when a nav link is clicked
 */
export default function Navbar({ onMenuClick, activeItem, onNavClick }) {
  return (
    <header className="cn-navbar">
      <button
        className="cn-hamburger"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <Menu size={22} strokeWidth={1.75} />
      </button>


      <nav className="cn-navlinks">
        {NAV_ITEMS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={`cn-navlink ${activeItem === label ? 'is-active' : ''}`}
            onClick={() => onNavClick && onNavClick(label)}
          >
            <Icon size={16} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
