import { useState, useEffect, useId, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { KindGlyph } from '../ui/vis';
import { initialsOf, roleKind, roleLabel } from '../../pages/Profile/labels';
import '../../pages/Profile/profile.css';

export interface UserOption {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  semester?: number;
  profileImage?: string;
  universityId?: string;
  enrollmentNumber?: string;
  phone?: string;
}

export interface UserSelectProps {
  role: 'student' | 'faculty_coordinator' | 'faculty_mentor';
  value: string;
  onChange: (userId: string, user?: UserOption | null) => void;
  disabledUserIds?: string[];
  disabledReason?: string | ((user: UserOption) => string);
  placeholder?: string;
  emptyMessage?: string;
  label?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

const ROLE_DEFAULTS: Record<UserSelectProps['role'], { placeholder: string; emptyMessage: string }> = {
  student: {
    placeholder: 'Search student by name, email, or department...',
    emptyMessage: 'No registered students found',
  },
  faculty_mentor: {
    placeholder: 'Search faculty mentor by name, email, or department...',
    emptyMessage: 'No eligible mentors available',
  },
  faculty_coordinator: {
    placeholder: 'Search faculty coordinator by name or email...',
    emptyMessage: 'No registered coordinators found',
  },
};

const FALLBACK_DEFAULTS = { placeholder: 'Search users...', emptyMessage: 'No users found' };

function personMeta(user: UserOption) {
  return [
    user.enrollmentNumber ? `Enrollment: ${user.enrollmentNumber}` : '',
    user.department || '',
    user.semester ? `Semester ${user.semester}` : '',
  ].filter(Boolean) as string[];
}

/** One line for the row: the facts you scan by, not the ones you look up. */
function personLine(user: UserOption) {
  return [
    user.email,
    user.department || '',
    user.semester ? `Sem ${user.semester}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The full record, kept on hover for the fields the row has no space for. */
function personTitle(user: UserOption) {
  return [user.email, ...personMeta(user)].filter(Boolean).join(' · ');
}

export function UserSelect({
  role,
  value,
  onChange,
  disabledUserIds = [],
  disabledReason = 'Already assigned',
  placeholder,
  emptyMessage,
  label,
  id,
  required,
  disabled = false,
}: UserSelectProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPlacement, setMenuPlacement] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    listMax: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const { placeholder: defaultPlaceholder, emptyMessage: defaultEmptyMessage } =
    ROLE_DEFAULTS[role] ?? FALLBACK_DEFAULTS;

  // Fetch users from MongoDB Atlas via GET /api/users?role=${role}
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: UserOption[] }>('GET', `/users?role=${role}`);
      setUsers(res.data || []);
    } catch (err: any) {
      console.error(`Failed to load ${role} users:`, err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [role]);

  // Selected user object
  const selectedUser = useMemo(() => {
    return users.find((u) => u._id === value) || null;
  }, [users, value]);

  // Filter users by search term (name, email, department)
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase().trim();
    return users.filter((u) => {
      const nameMatch = u.name.toLowerCase().includes(term);
      const emailMatch = u.email.toLowerCase().includes(term);
      const deptMatch = u.department ? u.department.toLowerCase().includes(term) : false;
      const enrMatch = u.enrollmentNumber ? u.enrollmentNumber.toLowerCase().includes(term) : false;
      return nameMatch || emailMatch || deptMatch || enrMatch;
    });
  }, [users, searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
      setSearchTerm('');
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // The menu is portalled, so its geometry is recalculated from the trigger.
  // Any scroll outside the menu (page or modal) closes it rather than letting
  // it drift away from the control.
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = (event: Event) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      setIsOpen(false);
      setSearchTerm('');
    };
    const handleResize = () => {
      setIsOpen(false);
      setSearchTerm('');
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Keep the highlighted option inside the scroll area as the keyboard moves
  useEffect(() => {
    if (!isOpen) return;
    const node = listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');
    node?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  const openMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
    const available = Math.max(160, (placeAbove ? spaceAbove : spaceBelow) - 12);

    setMenuPlacement({
      left: rect.left,
      width: rect.width,
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      listMax: Math.max(120, Math.min(260, available - 56)),
    });
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleSelect = (user: UserOption) => {
    const isDisabled = disabledUserIds.includes(user._id);
    if (isDisabled) return;
    onChange(user._id, user);
    setIsOpen(false);
    setSearchTerm('');
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
    if (inputRef.current) inputRef.current.focus();
    else triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredUsers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredUsers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredUsers.length) {
        handleSelect(filteredUsers[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      triggerRef.current?.focus();
    }
  };

  const getDisabledText = (user: UserOption) => {
    if (typeof disabledReason === 'function') {
      return disabledReason(user);
    }
    return disabledReason;
  };

  return (
    <div ref={containerRef} className="prf-usel">
      {label && (
        <label className="ui-label" htmlFor={id}>
          {label} {required && <span className="prf-req" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="prf-usel__control">
        <button
          id={id}
          ref={triggerRef}
          type="button"
          className={`ui-field prf-usel__trigger${selectedUser && !disabled ? ' prf-usel__trigger--clearable' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          disabled={disabled}
          onClick={() => {
            if (isOpen) closeMenu();
            else openMenu();
          }}
          onKeyDown={handleKeyDown}
        >
          {selectedUser ? (
            <>
              <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                {selectedUser.profileImage ? (
                  <img src={selectedUser.profileImage} alt="" />
                ) : (
                  initialsOf(selectedUser.name)
                )}
              </span>
              <span className="prf-usel__text">
                <span className="prf-usel__head">
                  <span className="prf-usel__name">{selectedUser.name}</span>
                  {selectedUser.role && (
                    <span className="ui-tag ui-tag--plain prf-usel__role">
                      <KindGlyph kind={roleKind(selectedUser.role)} size={11} />
                      {roleLabel(selectedUser.role)}
                    </span>
                  )}
                </span>
                <span className="prf-usel__sub" title={personTitle(selectedUser)}>
                  {personLine(selectedUser)}
                </span>
              </span>
            </>
          ) : (
            <span className="prf-usel__placeholder">{placeholder || defaultPlaceholder}</span>
          )}

          <ChevronIcon />
        </button>

        {selectedUser && !disabled && (
          <button
            type="button"
            className="ui-icon-btn prf-usel__clear"
            onClick={handleClear}
            title="Clear selection"
            aria-label="Clear selection"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {isOpen && !disabled && menuPlacement && createPortal(
        <div
          ref={menuRef}
          className="ui-menu prf-usel__menu"
          aria-busy={loading}
          style={{
            left: menuPlacement.left,
            top: menuPlacement.top,
            bottom: menuPlacement.bottom,
            width: menuPlacement.width,
          }}
        >
          <div className="ui-search prf-usel__search">
            <SearchIcon />
            <input
              ref={inputRef}
              className="ui-field"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Filter by name, email or department"
              aria-label="Filter users"
              aria-controls={listId}
              aria-activedescendant={
                highlightedIndex >= 0 && highlightedIndex < filteredUsers.length
                  ? `${listId}-option-${highlightedIndex}`
                  : undefined
              }
              autoFocus
            />
          </div>

          {loading ? (
            <div className="prf-usel__skeleton" aria-label="Loading registered users">
              {[0, 1, 2].map(row => (
                <div className="prf-usel__skeleton-row" key={row}>
                  <span className="ui-skel prf-usel__skeleton-avatar" />
                  <span className="prf-usel__skeleton-lines">
                    <span className="ui-skel prf-usel__skeleton-line" />
                    <span className="ui-skel prf-usel__skeleton-line prf-usel__skeleton-line--short" />
                  </span>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="ui-notice ui-notice--error prf-usel__notice">
              <span>{error}</span>
              <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={loadUsers}>
                Retry
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="prf-usel__state" aria-live="polite">
              {searchTerm.trim()
                ? `No registered ${role.replace('_', ' ')}s matching "${searchTerm}"`
                : emptyMessage || defaultEmptyMessage}
            </div>
          ) : (
            <div
              ref={listRef}
              id={listId}
              className="prf-usel__list"
              role="listbox"
              aria-label={label ? `${label} options` : 'Options'}
              style={{ maxHeight: menuPlacement.listMax }}
            >
              {filteredUsers.map((user, idx) => {
                const isAssigned = disabledUserIds.includes(user._id);
                const isSelected = user._id === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={user._id}
                    id={`${listId}-option-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isAssigned}
                    data-selected={isSelected || undefined}
                    data-disabled={isAssigned || undefined}
                    data-highlighted={isHighlighted || undefined}
                    className="prf-usel__option"
                    onClick={() => handleSelect(user)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                      {user.profileImage ? <img src={user.profileImage} alt="" /> : initialsOf(user.name)}
                    </span>

                    <span className="prf-usel__option-text">
                      <span className="prf-usel__head">
                        <span className="prf-usel__name">{user.name}</span>
                        {user.role && (
                          <span className="ui-tag ui-tag--plain prf-usel__role">
                            <KindGlyph kind={roleKind(user.role)} size={11} />
                            {roleLabel(user.role)}
                          </span>
                        )}
                      </span>
                      <span className="prf-usel__sub" title={personTitle(user)}>
                        {personLine(user)}
                      </span>
                    </span>

                    {isAssigned ? (
                      <span className="ui-tag ui-tag--plain">{getDisabledText(user)}</span>
                    ) : isSelected ? (
                      <CheckIcon />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="prf-usel__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.6 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="prf-usel__check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default UserSelect;
