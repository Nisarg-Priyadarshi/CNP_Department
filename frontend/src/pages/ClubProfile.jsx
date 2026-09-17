import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockClubs, mockStudents, mockProjects, mockEvents } from '../data/mockData';
import { useUser } from '../context/UserContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { 
  Shield, 
  UserPlus, 
  Trash2, 
  Settings, 
  Briefcase, 
  Calendar, 
  CheckCircle,
  Users,
  Award
} from 'lucide-react';

const ClubProfile = () => {
  const { clubId } = useParams();
  const { activeRole, currentUser } = useUser();
  const [club, setClub] = useState(null);
  
  // Local list of office bearers and members to demonstrate mentor actions interactively
  const [bearers, setBearers] = useState([]);
  const [members, setMembers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [positionInput, setPositionInput] = useState('President');

  const positions = [
    'President', 'Vice President', 'Secretary', 'Joint Secretary', 
    'Event Manager', 'Event Coordinator', 'Technical Head', 
    'Graphic Designer', 'Social Media Manager', 'Treasurer', 
    'PR', 'Marketing Head', 'Documentation Head'
  ];

  useEffect(() => {
    const foundClub = mockClubs.find(c => c.id === clubId) || mockClubs[0];
    if (foundClub) {
      setClub(foundClub);
      
      // Get office bearers from current club mock data merged with student profile academic info
      const clubBearers = foundClub.officeBearers.map(b => {
        const studentInfo = mockStudents.find(s => s.id === b.studentId);
        return {
          studentId: b.studentId,
          name: b.name,
          position: b.position,
          course: studentInfo ? studentInfo.course : 'N/A',
          year: studentInfo ? studentInfo.year : 'N/A'
        };
      });
      setBearers(clubBearers);

      // Get all students enrolled in this club as standard members
      const clubMembers = mockStudents.filter(s => s.clubs.includes(foundClub.name));
      setMembers(clubMembers);
    }
  }, [clubId]);

  if (!club) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading club details...</div>;
  }

  // Mentor controls
  const handleAssignPosition = () => {
    if (!selectedStudent) return;
    
    // Check if they are already in the office bearers list
    const existingIndex = bearers.findIndex(b => b.studentId === selectedStudent.id);
    const updatedBearers = [...bearers];

    const bearerData = {
      studentId: selectedStudent.id,
      name: selectedStudent.name,
      position: positionInput,
      course: selectedStudent.course,
      year: selectedStudent.year
    };

    if (existingIndex > -1) {
      // Modify position
      updatedBearers[existingIndex] = bearerData;
    } else {
      // Add new position
      updatedBearers.push(bearerData);
    }

    setBearers(updatedBearers);
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleRemovePosition = (studentId) => {
    const updated = bearers.filter(b => b.studentId !== studentId);
    setBearers(updated);
  };

  const isMentor = ['Mentor', 'Admin'].includes(activeRole);

  // Group office bearers to show hierarchy tiers
  const tier1 = bearers.filter(b => ['President', 'Vice President'].includes(b.position));
  const tier2 = bearers.filter(b => ['Secretary', 'Joint Secretary', 'Treasurer', 'Technical Head'].includes(b.position));
  const tier3 = bearers.filter(b => !['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer', 'Technical Head'].includes(b.position));

  // Projects filter
  const clubProjects = mockProjects.filter(p => p.clubId === club.id);
  const clubEvents = mockEvents.filter(e => e.organizer === club.name);

  return (
    <div className="page-enter page-container">
      {/* Top Banner details */}
      <div 
        style={{
          backgroundColor: 'var(--white)',
          border: '1px solid var(--border-color)',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
          display: 'flex',
          gap: '2rem',
          alignItems: 'center'
        }}
        className="club-banner"
      >
        <div 
          style={{
            width: '80px',
            height: '80px',
            backgroundColor: 'var(--off-white)',
            border: '2px solid var(--border-color)',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            flexShrink: 0
          }}
        >
          {club.logo}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-900)' }}>
              {club.name}
            </h1>
            <Badge text={club.category} />
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.95rem', maxWidth: '800px' }}>
            {club.description}
          </p>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Faculty Mentor:</span>{' '}
              <strong style={{ color: 'var(--navy-900)' }}>{club.mentor || 'None'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Student Count:</span>{' '}
              <strong style={{ color: 'var(--text-dark)' }}>{members.length} Members</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of contents */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr 1fr', 
          gap: '2rem',
          alignItems: 'start'
        }}
        className="club-grid"
      >
        {/* Left Side Content: Hierarchy / Team Structure */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div 
            style={{
              backgroundColor: 'var(--white)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} />
              <span>Office Bearers Hierarchy</span>
            </h2>

            {bearers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No office bearers assigned to this club yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
                
                {/* Tier 1: Leadership */}
                {tier1.length > 0 && (
                  <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
                    {tier1.map(b => (
                      <div 
                        key={b.studentId}
                        style={{
                          width: '240px',
                          border: '2px solid var(--navy-900)',
                          borderRadius: '0.75rem',
                          padding: '1.25rem',
                          textAlign: 'center',
                          backgroundColor: 'var(--white)',
                          position: 'relative'
                        }}
                        className="card-hover"
                      >
                        {isMentor && (
                          <button 
                            onClick={() => handleRemovePosition(b.studentId)}
                            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: 'var(--danger)', padding: '0.25rem' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <Avatar name={b.name} size="lg" className="avatar-hover" style={{ margin: '0 auto 0.75rem' }} />
                        <h4 style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{b.name}</h4>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-900)', textTransform: 'uppercase', display: 'block', margin: '0.25rem 0' }}>
                          {b.position}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {b.course} • {b.year}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tier 2: Administration */}
                {tier2.length > 0 && (
                  <div 
                    style={{ 
                      display: 'flex', 
                      gap: '1rem', 
                      justifyContent: 'center', 
                      width: '100%', 
                      flexWrap: 'wrap', 
                      borderTop: '1px dashed var(--border-color)', 
                      paddingTop: '1.5rem' 
                    }}
                  >
                    {tier2.map(b => (
                      <div 
                        key={b.studentId}
                        style={{
                          width: '200px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.75rem',
                          padding: '1rem',
                          textAlign: 'center',
                          backgroundColor: 'var(--off-white)',
                          position: 'relative'
                        }}
                        className="card-hover"
                      >
                        {isMentor && (
                          <button 
                            onClick={() => handleRemovePosition(b.studentId)}
                            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: 'var(--danger)', padding: '0.25rem' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <Avatar name={b.name} size="md" style={{ margin: '0 auto 0.5rem' }} />
                        <h5 style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{b.name}</h5>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-800)', textTransform: 'uppercase', display: 'block', margin: '0.25rem 0' }}>
                          {b.position}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {b.course.split(' ')[0]} • {b.year}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tier 3: Coordinators & Designers */}
                {tier3.length > 0 && (
                  <div 
                    style={{ 
                      display: 'flex', 
                      gap: '1rem', 
                      justifyContent: 'center', 
                      width: '100%', 
                      flexWrap: 'wrap', 
                      borderTop: '1px dashed var(--border-color)', 
                      paddingTop: '1.5rem' 
                    }}
                  >
                    {tier3.map(b => (
                      <div 
                        key={b.studentId}
                        style={{
                          width: '180px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.75rem',
                          padding: '1rem',
                          textAlign: 'center',
                          backgroundColor: 'var(--white)',
                          position: 'relative'
                        }}
                        className="card-hover"
                      >
                        {isMentor && (
                          <button 
                            onClick={() => handleRemovePosition(b.studentId)}
                            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: 'var(--danger)', padding: '0.25rem' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <Avatar name={b.name} size="md" style={{ margin: '0 auto 0.5rem' }} />
                        <h5 style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{b.name}</h5>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', margin: '0.25rem 0' }}>
                          {b.position}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {b.year}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Club Projects */}
          <div 
            style={{
              backgroundColor: 'var(--white)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={18} />
              <span>Active Club Projects</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {clubProjects.length > 0 ? (
                clubProjects.map(proj => (
                  <div key={proj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }} className="row-hover">
                    <div>
                      <h4 style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{proj.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deadline: {proj.deadline}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '100px', display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{proj.progress}%</span>
                        <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${proj.progress}%`, backgroundColor: 'var(--navy-900)' }} />
                        </div>
                      </div>
                      <Badge text={proj.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No projects registered.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Content: Mentors / Member Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Mentor Actions Panel */}
          {isMentor && (
            <div 
              style={{
                backgroundColor: 'var(--white)',
                border: '2px solid var(--navy-900)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} />
                <span>Mentor Control Panel</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Manage student administrative roles and appoint office bearer positions.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Assign Role to Member:
                </div>
                {members.map(member => (
                  <div 
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--off-white)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Avatar name={member.name} size="sm" />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>{member.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{member.rollId}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStudent(member);
                        setIsModalOpen(true);
                      }}
                      className="btn-hover"
                      style={{
                        padding: '0.35rem 0.5rem',
                        borderRadius: '0.25rem',
                        backgroundColor: 'var(--navy-900)',
                        color: 'var(--white)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <UserPlus size={12} />
                      <span>Appoint</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Club Events */}
          <div 
            style={{
              backgroundColor: 'var(--white)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} />
              <span>Upcoming Club Events</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {clubEvents.length > 0 ? (
                clubEvents.map(evt => (
                  <div key={evt.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--navy-900)', borderRadius: '0.375rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--sky-200)', lineHeight: 1 }}>
                        {new Date(evt.date).toLocaleString('default', { month: 'short' })}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1 }}>
                        {new Date(evt.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>{evt.name}</h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{evt.time}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No events planned.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Appointment assignment modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Assign Position - ${selectedStudent?.name}`}
      >
        <div className="form-group">
          <label className="form-label" htmlFor="position-select">Choose Position Hierarchy:</label>
          <select
            id="position-select"
            className="form-input"
            value={positionInput}
            onChange={(e) => setPositionInput(e.target.value)}
          >
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button 
            onClick={() => setIsModalOpen(false)} 
            className="btn-hover"
            style={{ border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button 
            onClick={handleAssignPosition}
            className="btn-hover"
            style={{ backgroundColor: 'var(--navy-900)', color: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
          >
            Save Appointment
          </button>
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 1024px) {
          .club-banner {
            flex-direction: column;
            text-align: center;
            align-items: center !important;
          }
          .club-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
    </div>
  );
};

export default ClubProfile;
