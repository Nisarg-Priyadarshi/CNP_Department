import React, { useState } from 'react';
import Modal from '../components/Modal';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, Tag } from 'lucide-react';

const Calendar = () => {
  // We lock calendar view to August 2026 to align with mock database
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(7); // 0-indexed, so 7 is August
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calendar event database matching events, deadlines, and approvals
  const calendarItems = [
    { id: 'cal-1', title: 'Tree Plantation Drive', date: '2026-08-10', type: 'Event', time: '08:00 AM - 12:00 PM', venue: 'North Campus Grounds', desc: 'Eco friendly tree plantation drive by Social Service club. 500 saplings.', color: 'var(--navy-900)', bg: 'var(--sky-100)' },
    { id: 'cal-2', title: 'Approval: ML Workshop Setup', date: '2026-08-12', type: 'Approval Deadline', time: '12:00 PM', venue: 'Mentor Cabinet Portal', desc: 'Deadline to submit room booking and guest lists clearance.', color: '#92400e', bg: '#fef3c7' },
    { id: 'cal-3', title: 'Approval: 2x Raspberry Pi 4 Issue', date: '2026-08-14', type: 'Approval Deadline', time: '04:00 PM', venue: 'Inventory Desk', desc: 'Equipment issue request confirmation for Coding Club neural server project.', color: '#92400e', bg: '#fef3c7' },
    { id: 'cal-4', title: 'CodeQuest 2026 Hackathon', date: '2026-08-20', type: 'Event', time: '10:00 AM - 05:00 PM', venue: 'Main Computer Lab 3', desc: '7-hour rapid prototyping hackathon focusing on civic applications.', color: 'var(--navy-900)', bg: 'var(--sky-100)' },
    { id: 'cal-5', title: 'NGO Donation Portal Deadline', date: '2026-08-20', type: 'Project Deadline', time: '05:00 PM', venue: 'CNP Project Office', desc: 'Deadline to submit finalized codebase and deployment links.', color: '#9d174d', bg: 'var(--pink-100)' },
    { id: 'cal-6', title: 'ML Workshop 2026', date: '2026-08-22', type: 'Event', time: '02:00 PM - 05:00 PM', venue: 'Seminar Hall A', desc: 'Introductory training workshops on fine-tuning open source LLMs.', color: 'var(--navy-900)', bg: 'var(--sky-100)' },
    { id: 'cal-7', title: 'RoboExpo 2026 Exhibition', date: '2026-08-25', type: 'Event', time: '09:00 AM - 04:00 PM', venue: 'College Gymnasium', desc: 'Showcase exhibition for department robots, rovers, and design prototypes.', color: 'var(--navy-900)', bg: 'var(--sky-100)' },
    { id: 'cal-8', title: 'Dance Off 2026 Carnival', date: '2026-08-28', type: 'Event', time: '05:30 PM - 08:30 PM', venue: 'Open Air Theater', desc: 'Inter-department creative and choreography performance contest.', color: 'var(--navy-900)', bg: 'var(--sky-100)' },
    { id: 'cal-9', title: 'AI Assistant Project Deadline', date: '2026-08-30', type: 'Project Deadline', time: '11:59 PM', venue: 'CNP Evaluation Desk', desc: 'Final project review and evaluation report upload.', color: '#9d174d', bg: 'var(--pink-100)' },
    { id: 'cal-10', title: 'Poetry Slam 2026 Session', date: '2026-09-02', type: 'Event', time: '03:00 PM - 05:00 PM', venue: 'Library Reading Room', desc: 'Debate, poetry slam, and spoken word reading sessions.', color: 'var(--navy-900)', bg: 'var(--sky-100)' }
  ];

  // Helper to generate dates grid in month
  const getDaysInMonth = (year, month) => {
    // month is 0-indexed
    const firstDayIndex = new Date(year, month, 1).getDay();
    const numberOfDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Add empty space fillers for preceding month offset
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    
    // Add dates
    for (let i = 1; i <= numberOfDays; i++) {
      days.push(i);
    }
    
    return days;
  };

  const calendarDays = getDaysInMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const getItemsForDate = (dateNum) => {
    if (!dateNum) return [];
    
    // Pad numbers for iso matching
    const dayStr = String(dateNum).padStart(2, '0');
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const matchStr = `${currentYear}-${monthStr}-${dayStr}`;

    return calendarItems.filter(item => item.date === matchStr);
  };

  return (
    <div className="page-enter page-container">
      {/* Calendar Control Navigation Bar */}
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
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CalendarIcon size={24} style={{ color: 'var(--navy-900)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>
            {monthNames[currentMonth]} {currentYear}
          </h2>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--sky-100)', border: '1px solid var(--sky-200)' }} />
            <span style={{ fontWeight: 500, color: 'var(--text-dark)' }}>Events</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--pink-100)', border: '1px solid var(--pink-200)' }} />
            <span style={{ fontWeight: 500, color: 'var(--text-dark)' }}>Project Deadlines</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fef3c7', border: '1px solid #fca5a5' }} />
            <span style={{ fontWeight: 500, color: 'var(--text-dark)' }}>Approvals</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={prevMonth} 
            className="btn-hover"
            style={{ 
              padding: '0.5rem', 
              borderRadius: '0.375rem', 
              border: '1px solid var(--border-color)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'var(--white)'
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={nextMonth} 
            className="btn-hover"
            style={{ 
              padding: '0.5rem', 
              borderRadius: '0.375rem', 
              border: '1px solid var(--border-color)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'var(--white)'
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Calendar Grid Sheet */}
      <div 
        style={{
          backgroundColor: 'var(--white)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}
      >
        {/* Days of Week Row */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--off-white)',
            textAlign: 'center'
          }}
        >
          {daysOfWeek.map((day) => (
            <div 
              key={day}
              style={{
                padding: '0.75rem 0',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'var(--text-muted)'
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Dates Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: 'minmax(120px, 1fr)'
          }}
        >
          {calendarDays.map((dayNum, idx) => {
            const dateItems = getItemsForDate(dayNum);
            const isToday = dayNum === 14 && currentMonth === 7 && currentYear === 2026; // August 14, 2026 is simulated current time
            
            return (
              <div 
                key={idx}
                style={{
                  borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-color)' : 'none',
                  borderBottom: idx < calendarDays.length - 7 ? '1px solid var(--border-color)' : 'none',
                  padding: '0.5rem',
                  backgroundColor: dayNum ? (isToday ? 'var(--sky-50)' : 'var(--white)') : 'var(--off-white)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  position: 'relative'
                }}
              >
                {dayNum && (
                  <span 
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--navy-900)' : 'var(--text-dark)',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isToday ? 'var(--sky-200)' : 'transparent',
                      marginBottom: '0.25rem'
                    }}
                  >
                    {dayNum}
                  </span>
                )}

                {/* Calendar Events pins inside date blocks */}
                {dayNum && dateItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedItem(item);
                      setIsModalOpen(true);
                    }}
                    className="btn-hover"
                    style={{
                      width: '100%',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      backgroundColor: item.bg,
                      color: item.color,
                      border: `1px solid ${item.type === 'Approval Deadline' ? '#fca5a5' : 'transparent'}`,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'block'
                    }}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar Item Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedItem?.type || 'Calendar Item'}
      >
        {selectedItem && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem' }}>
              {selectedItem.title}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                <Clock size={16} style={{ color: 'var(--navy-900)', flexShrink: 0 }} />
                <span><strong>Time:</strong> {selectedItem.time}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                <MapPin size={16} style={{ color: 'var(--navy-900)', flexShrink: 0 }} />
                <span><strong>Location/Venue:</strong> {selectedItem.venue}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                <Tag size={16} style={{ color: 'var(--navy-900)', flexShrink: 0 }} />
                <span><strong>Category/Type:</strong> <span style={{ fontWeight: 600 }}>{selectedItem.type}</span></span>
              </div>
            </div>

            <div 
              style={{ 
                backgroundColor: 'var(--off-white)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '0.5rem', 
                padding: '1rem',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                color: 'var(--text-dark)'
              }}
            >
              <strong>Description:</strong>
              <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                {selectedItem.desc}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn-hover"
                style={{ 
                  backgroundColor: 'var(--navy-900)', 
                  color: 'var(--white)', 
                  padding: '0.5rem 1.5rem', 
                  borderRadius: '0.375rem', 
                  fontWeight: 600 
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Calendar;
