import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockStudents, mockProjects, mockEvents } from '../data/mockData';
import { useUser } from '../context/UserContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import { Mail, GraduationCap, Code, Layers, Calendar, Briefcase, LogOut } from 'lucide-react';

const StudentProfile = () => {
  const { studentId } = useParams();
  const { currentUser, logout, activeRole } = useUser();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    if (studentId) {
      const found = mockStudents.find(s => s.id === studentId);
      setStudent(found || null);
    } else {
      setStudent(currentUser);
    }
  }, [studentId, currentUser]);

  if (!student) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Student profile not found.
      </div>
    );
  }

  const isOwnProfile = !studentId || student.id === currentUser?.id;

  // Filter projects where student is listed in team members
  const studentProjects = mockProjects.filter(p => 
    p.team.some(member => member.toLowerCase() === student.name.toLowerCase())
  );

  // Filter events organized by the student's clubs
  const studentEvents = mockEvents.filter(e => 
    student.clubs.includes(e.organizer)
  );

  return (
    <div className="page-enter page-container">
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '2rem',
          alignItems: 'start'
        }}
        className="profile-layout"
      >
        {/* Left Card: Core Credentials */}
        <div 
          style={{
            backgroundColor: 'var(--white)',
            border: '1px solid var(--border-color)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Avatar name={student.name} size="xl" className="avatar-hover" style={{ marginBottom: '1.5rem' }} />
          
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            {student.name}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>
            ID: {student.rollId}
          </span>

          <div style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            <Badge text={isOwnProfile ? activeRole : student.role} />
          </div>

          <div 
            style={{
              width: '100%',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
              <GraduationCap size={18} style={{ color: 'var(--navy-900)', flexShrink: 0, marginTop: '0.125rem' }} />
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>BRANCH & COURSE</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>{student.course}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
              <Layers size={18} style={{ color: 'var(--navy-900)', flexShrink: 0, marginTop: '0.125rem' }} />
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACADEMIC YEAR</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>{student.year}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
              <Mail size={18} style={{ color: 'var(--navy-900)', flexShrink: 0, marginTop: '0.125rem' }} />
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>EMAIL ADDRESS</span>
                <a href={`mailto:${student.email}`} style={{ fontSize: '0.875rem', color: 'var(--navy-800)', fontWeight: 600 }}>
                  {student.email}
                </a>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="btn-hover"
              style={{
                width: '100%',
                marginTop: '2rem',
                padding: '0.75rem',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                backgroundColor: '#fee2e2',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          )}
        </div>

        {/* Right Panel: Tabs/Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Skills Card */}
          <div 
            style={{
              backgroundColor: 'var(--white)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Code size={18} />
              <span>Skills & Expertise</span>
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {student.skills.map((skill, idx) => (
                <span 
                  key={idx}
                  style={{
                    backgroundColor: 'var(--off-white)',
                    border: '1px solid var(--border-color)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: 'var(--text-dark)'
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Enrolled Clubs */}
          <div 
            style={{
              backgroundColor: 'var(--white)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} />
              <span>Enrolled Clubs & Societies</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {student.clubs.map((clubName, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '0.85rem 1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--off-white)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: 'var(--navy-900)'
                  }}
                >
                  {clubName}
                </div>
              ))}
            </div>
          </div>

          {/* Project Contributions */}
          <div 
            style={{
              backgroundColor: 'var(--white)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={18} />
              <span>Project Contributions</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {studentProjects.length > 0 ? (
                studentProjects.map(proj => (
                  <div 
                    key={proj.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    className="row-hover"
                  >
                    <div>
                      <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{proj.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Progress: {proj.progress}%</span>
                    </div>
                    <Badge text={proj.status} />
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No active project contributions recorded.
                </div>
              )}
            </div>
          </div>

          {/* Attending Events */}
          <div 
            style={{
              backgroundColor: 'var(--white)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} />
              <span>Upcoming & Registered Events</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {studentEvents.length > 0 ? (
                studentEvents.map(evt => (
                  <div 
                    key={evt.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    className="row-hover"
                  >
                    <div>
                      <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{evt.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Organizer: {evt.organizer}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-900)' }}>
                      {evt.date}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No registered events schedules.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .profile-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
    </div>
  );
};

export default StudentProfile;
