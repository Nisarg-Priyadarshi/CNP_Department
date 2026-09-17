import React from 'react';

const Badge = ({ type = 'default', text = '' }) => {
  const getBadgeClass = (val) => {
    const v = val.toLowerCase().replace(/\s+/g, '');
    
    // Status mappings
    if (v === 'inprogress') return 'badge-warning';
    if (v === 'submitted') return 'badge-info';
    if (v === 'underreview') return 'badge-purple';
    if (v === 'approved') return 'badge-success';
    if (v === 'completed') return 'badge-success';
    
    // Role mappings
    if (v === 'admin') return 'badge-purple';
    if (v === 'mentor') return 'badge-info';
    if (v === 'officebearer') return 'badge-pink';
    if (v === 'student') return 'badge-success';
    
    // Default fallback
    return 'badge-info';
  };

  return (
    <span className={`badge ${getBadgeClass(text || type)}`}>
      {text || type}
    </span>
  );
};

export default Badge;
