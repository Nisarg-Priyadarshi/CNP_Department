import React from 'react';

const Avatar = ({ name = '', size = 'md', className = '' }) => {
  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Determine a consistent background color based on name
  const getBgColor = (fullName) => {
    const code = fullName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return code % 2 === 0 ? 'var(--pink-200)' : 'var(--sky-200)';
  };

  const getTextColor = (fullName) => {
    const code = fullName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return code % 2 === 0 ? '#9d174d' : '#0369a1';
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-20 h-20 text-xl',
    xl: 'w-32 h-32 text-3xl'
  };

  const dimensions = {
    sm: { width: '32px', height: '32px', fontSize: '12px' },
    md: { width: '48px', height: '48px', fontSize: '14px' },
    lg: { width: '80px', height: '80px', fontSize: '24px' },
    xl: { width: '120px', height: '120px', fontSize: '36px' }
  };

  const dim = dimensions[size] || dimensions.md;

  return (
    <div
      className={`avatar-hover ${className}`}
      style={{
        width: dim.width,
        height: dim.height,
        borderRadius: '50%',
        backgroundColor: getBgColor(name),
        color: getTextColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '700',
        fontSize: dim.fontSize,
        border: '2px solid var(--white)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
