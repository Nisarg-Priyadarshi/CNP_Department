import React, { useState, useMemo } from 'react';
import { mockEvents } from '../data/mockData';
import { useUser } from '../context/UserContext';
import { Search, Calendar, MapPin, Clock, Plus, Users } from 'lucide-react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const Events = () => {
  const { activeRole } = useUser();
  
  // Local state to manage events interactively
  const [events, setEvents] = useState(mockEvents);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for creating event
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formVenue, setFormVenue] = useState('');
  const [formOrganizer, setFormOrganizer] = useState('Coding Club');
  const [formDescription, setFormDescription] = useState('');

  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const matchesSearch = evt.name.toLowerCase().includes(search.toLowerCase()) || 
        evt.organizer.toLowerCase().includes(search.toLowerCase()) ||
        evt.venue.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || evt.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [events, search, statusFilter]);

  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!formName || !formDate || !formVenue) return;

    const newEvent = {
      id: `evt-${Date.now()}`,
      name: formName,
      date: formDate,
      time: formTime || '10:00 AM - 12:00 PM',
      venue: formVenue,
      organizer: formOrganizer,
      participants: 0,
      status: 'Upcoming',
      description: formDescription || 'No description provided.'
    };

    setEvents([newEvent, ...events]);
    setIsModalOpen(false);

    // Clear form
    setFormName('');
    setFormDate('');
    setFormTime('');
    setFormVenue('');
    setFormDescription('');
  };

  const canCreate = ['Admin', 'Mentor', 'Office Bearer'].includes(activeRole);

  return (
    <div className="page-enter page-container">
      {/* Filters & Actions Bar */}
      <div 
        style={{
          backgroundColor: 'var(--white)',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
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
              placeholder="Search by event name, club, or venue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Status selector */}
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="All">All Statuses</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {/* Create Event Button (Dynamic representation based on activeRole) */}
        {canCreate ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--navy-900)',
              color: 'var(--white)',
              padding: '0.75rem 1.25rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              boxShadow: '0 4px 6px -1px rgba(23, 37, 84, 0.15)'
            }}
          >
            <Plus size={18} />
            <span>Create Event</span>
          </button>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'var(--off-white)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            🔒 Create event restricted to office bearers/mentors.
          </div>
        )}
      </div>

      {/* Events Grid Card List */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {filteredEvents.length > 0 ? (
          filteredEvents.map(evt => (
            <div 
              key={evt.id}
              className="card-hover"
              style={{
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.025em', display: 'block' }}>
                      {evt.organizer}
                    </span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-dark)', marginTop: '0.125rem' }}>
                      {evt.name}
                    </h3>
                  </div>
                  <Badge text={evt.status} />
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {evt.description}
                </p>
              </div>

              <div 
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={15} style={{ color: 'var(--navy-900)' }} />
                  <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>{evt.date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={15} style={{ color: 'var(--navy-900)' }} />
                  <span>{evt.time}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={15} style={{ color: 'var(--navy-900)' }} />
                  <span>{evt.venue}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <Users size={15} style={{ color: 'var(--navy-900)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{evt.participants} Participants</span>
                </div>
              </div>
            </div>
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
            No events match your current query filters.
          </div>
        )}
      </div>

      {/* Create Event Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Campus Event"
      >
        <form onSubmit={handleCreateEvent}>
          <div className="form-group">
            <label className="form-label" htmlFor="evt-name">Event Name *</label>
            <input
              id="evt-name"
              type="text"
              className="form-input"
              placeholder="e.g. CodeQuest 2026"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="evt-date">Date *</label>
              <input
                id="evt-date"
                type="date"
                className="form-input"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="evt-time">Time</label>
              <input
                id="evt-time"
                type="text"
                className="form-input"
                placeholder="e.g. 10:00 AM - 05:00 PM"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="evt-venue">Venue *</label>
              <input
                id="evt-venue"
                type="text"
                className="form-input"
                placeholder="e.g. Seminar Hall A"
                value={formVenue}
                onChange={(e) => setFormVenue(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="evt-organizer">Organizer Club</label>
              <select
                id="evt-organizer"
                className="form-input"
                value={formOrganizer}
                onChange={(e) => setFormOrganizer(e.target.value)}
              >
                <option value="Coding Club">Coding Club</option>
                <option value="Robotics Club">Robotics Club</option>
                <option value="Cultural Club">Cultural Club</option>
                <option value="Creative Writing Club">Creative Writing Club</option>
                <option value="Sports Club">Sports Club</option>
                <option value="Social Service Club">Social Service Club</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="evt-desc">Event Description</label>
            <textarea
              id="evt-desc"
              className="form-input"
              rows="3"
              placeholder="Provide event details, eligibility, topics covered..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="btn-hover"
              style={{ border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-hover"
              style={{ backgroundColor: 'var(--navy-900)', color: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Submit Proposal
            </button>
          </div>
        </form>
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
        }
      `}} />
    </div>
  );
};

export default Events;
