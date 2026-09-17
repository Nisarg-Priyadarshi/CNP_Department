import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { mockClubs } from '../data/mockData';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

const Clubs = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name-asc');

  const categories = ['All', 'Technical', 'Cultural', 'Sports', 'Social', 'Creative'];

  const filteredAndSortedClubs = useMemo(() => {
    return mockClubs
      .filter((club) => {
        const matchesSearch = club.name.toLowerCase().includes(search.toLowerCase()) ||
          club.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || club.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') {
          return a.name.localeCompare(b.name);
        } else if (sortBy === 'name-desc') {
          return b.name.localeCompare(a.name);
        } else if (sortBy === 'members-desc') {
          return b.membersCount - a.membersCount;
        } else if (sortBy === 'members-asc') {
          return a.membersCount - b.membersCount;
        }
        return 0;
      });
  }, [search, categoryFilter, sortBy]);

  return (
    <div className="page-enter page-container">
      {/* Search and Filters Header */}
      <div 
        style={{
          backgroundColor: 'var(--white)',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '1rem',
            alignItems: 'center'
          }}
          className="filter-grid"
        >
          {/* Search box */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '1rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }} 
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search clubs by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Sort selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px' }}>
            <ArrowUpDown size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '0.5rem 2rem 0.5rem 0.75rem' }}
            >
              <option value="name-asc">Sort: A to Z</option>
              <option value="name-desc">Sort: Z to A</option>
              <option value="members-desc">Members: High to Low</option>
              <option value="members-asc">Members: Low to High</option>
            </select>
          </div>
        </div>

        {/* Category Pills Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.5rem' }}>
            <SlidersHorizontal size={14} />
            <span>Category:</span>
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="btn-hover"
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 500,
                backgroundColor: categoryFilter === cat ? 'var(--navy-900)' : 'var(--off-white)',
                color: categoryFilter === cat ? 'var(--white)' : 'var(--text-dark)',
                border: `1px solid ${categoryFilter === cat ? 'var(--navy-900)' : 'var(--border-color)'}`
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Clubs Grid List */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {filteredAndSortedClubs.length > 0 ? (
          filteredAndSortedClubs.map((club) => (
            <Link 
              key={club.id}
              to={`/club/${club.id}`}
              className="club-card"
              style={{
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <div className="club-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div 
                    style={{
                      width: '45px',
                      height: '45px',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--off-white)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {club.logo}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                      {club.name}
                    </h3>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {club.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="club-card-details">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
                  {club.description.length > 90 ? `${club.description.substring(0, 90)}...` : club.description}
                </p>

                <div 
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Mentor:</span>{' '}
                    <strong style={{ color: 'var(--text-dark)' }}>{club.mentor || 'Unassigned'}</strong>
                  </div>
                  <div 
                    style={{ 
                      backgroundColor: 'var(--sky-100)', 
                      color: 'var(--navy-900)', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '0.375rem', 
                      fontWeight: 600 
                    }}
                  >
                    {club.membersCount} Members
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div 
            style={{ 
              gridColumn: '1 / -1', 
              textAlign: 'center', 
              padding: '3rem', 
              backgroundColor: 'var(--white)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)'
            }}
          >
            No clubs found matching your search filters.
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
    </div>
  );
};

export default Clubs;
