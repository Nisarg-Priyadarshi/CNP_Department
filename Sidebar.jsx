import React, { useState } from 'react';
import {
  X,
  CalendarDays,
  GraduationCap,
  Landmark,
  Settings,
  ChevronDown,
} from './Icons';
import './Navbar.css';

const SECTIONS = [
  {
    id: 'events',
    icon: CalendarDays,
    title: 'Event Logistics',
    items: [
      { label: 'Upcoming Events', status: 'neutral' },
      { label: 'Live / Ongoing Events', status: 'live' },
      { label: 'Past Events', status: 'dim' },
    ],
  },
  {
    id: 'academic',
    icon: GraduationCap,
    title: 'Academic Projects',
    items: [
      { label: 'Active Projects', status: 'live' },
      { label: 'Evaluation Needed', status: 'attention' },
      { label: 'Past Projects', status: 'dim' },
    ],
  },
  {
    id: 'clubs',
    icon: Landmark,
    title: 'Club Audits',
    items: [
      { label: 'Active Clubs', status: 'live' },
      { label: 'Inactive / Banned Clubs', status: 'alert' },
    ],
  },
  {
    id: 'system',
    icon: Settings,
    title: 'System Tools',
    items: [
      { label: 'User Management', status: 'neutral' },
      { label: 'Settings', status: 'neutral' },
    ],
  },
];

/**
 * Slide-in sidebar with collapsible, tree-style sections.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose(): called when the backdrop or close button is clicked
 *  - onItemClick(sectionId, label): called when a leaf item is clicked
 */
export default function Sidebar({ isOpen, onClose, onItemClick }) {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  );

  const toggleSection = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <div
        className={`cn-backdrop ${isOpen ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`cn-sidebar ${isOpen ? 'is-open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="cn-sidebar-header">
          <button className="cn-close-btn" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
            <span>Close Sidebar</span>
          </button>
        </div>

        <div className="cn-sidebar-body">
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expanded[section.id];

            return (
              <div className="cn-tree-section" key={section.id}>
                <button
                  className="cn-tree-header"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isExpanded}
                >
                  <SectionIcon
                    size={16}
                    strokeWidth={1.75}
                    className="cn-tree-header-icon"
                  />
                  <span>{section.title}</span>
                  <ChevronDown
                    size={14}
                    className={`cn-chev ${isExpanded ? '' : 'is-collapsed'}`}
                  />
                </button>

                {isExpanded && (
                  <div className="cn-tree-list">
                    {section.items.map((item, i) => (
                      <button
                        className="cn-tree-item"
                        key={item.label}
                        onClick={() =>
                          onItemClick && onItemClick(section.id, item.label)
                        }
                      >
                        <span className="cn-tree-line">
                          {i !== section.items.length - 1 && (
                            <span className="cn-tree-vert-continue" />
                          )}
                        </span>
                        <span
                          className={`cn-status-dot cn-dot-${item.status}`}
                        />
                        <span className="cn-tree-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
