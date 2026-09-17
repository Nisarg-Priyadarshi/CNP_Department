import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { 
  mockEvents, 
  mockProjects, 
  mockRecentActivities, 
  mockApprovals 
} from '../data/mockData';
import { 
  Users, 
  Briefcase, 
  Calendar, 
  CheckSquare, 
  Activity,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const slidesData = [
  {
    id: 1,
    type: 'EVENT REGISTRATION',
    title: 'CodeQuest 2026 Hackathon',
    meta: 'Date: Aug 20, 2026 | Venue: Main Computer Lab 3',
    description: 'A 7-hour rapid prototyping hackathon focusing on solving civic issues around campus and city logistics. Cash prizes and internship referrals.',
    buttonText: 'Register for Hackathon',
    successMsg: 'Successfully registered for CodeQuest 2026! A confirmation email and calendar invite have been sent to you.',
    bgStyle: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    borderColor: 'var(--sky-200)'
  },
  {
    id: 2,
    type: 'PROJECT RECRUITMENT',
    title: 'Campus Navigation App Team',
    meta: 'Lead: Vedant Sharma | Status: 75% Completed',
    description: 'Join the team building an indoor layout mapping solution using BLE beacons. We are seeking 2 front-end designers to polish UI micro-animations.',
    buttonText: 'Apply to Join Team',
    successMsg: 'Application submitted successfully! The project lead (Vedant Sharma) has been notified and will review your profile.',
    bgStyle: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    borderColor: 'var(--pink-200)'
  },
  {
    id: 3,
    type: 'EVENT REGISTRATION',
    title: 'ML Workshop 2026',
    meta: 'Date: Aug 22, 2026 | Venue: Seminar Hall A',
    description: 'A hands-on coding tutorial showing students how to train and fine-tune lightweight 2B LLM models locally on consumer hardware.',
    buttonText: 'Secure Seat',
    successMsg: 'Seat secured successfully! Remember to bring a laptop with Python 3.10+ pre-installed to the seminar hall.',
    bgStyle: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    borderColor: 'var(--sky-200)'
  },
  {
    id: 4,
    type: 'PROJECT RECRUITMENT',
    title: 'AI Conversational Assistant',
    meta: 'Lead: Priya Patel | Status: 90% Completed',
    description: 'We are deploying a customized GPT helper mapped with college curriculum. Seeking technical documentation reviewers.',
    buttonText: 'Apply as Reviewer',
    successMsg: 'Thank you for applying as a reviewer! You will receive test links and documentation next Monday.',
    bgStyle: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    borderColor: 'var(--pink-200)'
  }
];

const Dashboard = () => {
  const { activeRole } = useUser();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalContent, setSuccessModalContent] = useState('');
  const [useStateDummy, setUseStateDummy] = useState(null); // Keep a dummy to allow easy state editing

  // Get subset of items for summary panels
  const upcomingEvents = mockEvents.slice(0, 3);
  const recentProjects = mockProjects.slice(0, 3);
  const pendingApprovals = mockApprovals.filter(a => a.status === 'Pending').slice(0, 3);

  const stats = [
    { label: 'Total Clubs', value: '24', icon: <Users size={24} />, color: 'var(--navy-900)', bg: 'var(--sky-100)', path: '/clubs' },
    { label: 'Active Projects', value: '48', icon: <Briefcase size={24} />, color: 'var(--navy-800)', bg: 'var(--pink-100)', path: '/projects' },
    { label: 'Upcoming Events', value: '12', icon: <Calendar size={24} />, color: '#0369a1', bg: 'var(--sky-50)', path: '/events' },
    { label: 'Pending Approvals', value: '7', icon: <CheckSquare size={24} />, color: '#9d174d', bg: 'var(--pink-50)', path: '/approvals' },
  ];

  return (
    <div className="page-enter page-container">
      {/* Top Banner */}
      <div 
        style={{
          backgroundColor: 'var(--navy-900)',
          color: 'var(--white)',
          padding: '2rem',
          borderRadius: '1rem',
          marginBottom: '2rem',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Welcome to the CNP Portal
          </h1>
          <p style={{ color: 'var(--sky-200)', maxWidth: '600px', fontSize: '0.95rem' }}>
            Manage student clubs, pitch new innovation projects, book department equipment, and track approvals all in one system.
          </p>
        </div>
        {/* Subtle accent backgrounds */}
        <div style={{ position: 'absolute', right: '-50px', top: '-50px', width: '200px', height: '200px', borderRadius: '50%', backgroundColor: 'rgba(186, 230, 253, 0.08)' }} />
        <div style={{ position: 'absolute', right: '100px', bottom: '-80px', width: '180px', height: '180px', borderRadius: '50%', backgroundColor: 'rgba(251, 207, 232, 0.05)' }} />
      </div>

      {/* Dynamic Slideshow Highlights Banner */}
      <div 
        style={{
          backgroundColor: 'var(--white)',
          border: `1px solid ${slidesData[currentSlide].borderColor}`,
          borderRadius: '1rem',
          padding: '1.75rem 2.5rem',
          marginBottom: '2rem',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          background: slidesData[currentSlide].bgStyle,
          transition: 'all 0.4s ease'
        }}
      >
        {/* Navigation arrows */}
        <button
          onClick={() => setCurrentSlide((prev) => (prev === 0 ? slidesData.length - 1 : prev - 1))}
          className="btn-hover"
          style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--white)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--navy-900)',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 10
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={() => setCurrentSlide((prev) => (prev === slidesData.length - 1 ? 0 : prev + 1))}
          className="btn-hover"
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--white)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--navy-900)',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 10
          }}
        >
          <ChevronRight size={18} />
        </button>

        {/* Slide Inner Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '2rem',
            alignItems: 'center'
          }}
          className="slideshow-grid"
        >
          <div style={{ animation: 'slideFade 0.4s ease' }} key={currentSlide}>
            <span 
              style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: 'var(--navy-900)', 
                backgroundColor: 'var(--white)', 
                padding: '0.25rem 0.65rem', 
                borderRadius: '9999px',
                border: '1px solid rgba(23, 37, 84, 0.1)',
                display: 'inline-block',
                marginBottom: '0.75rem',
                letterSpacing: '0.05em'
              }}
            >
              {slidesData[currentSlide].type}
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.25rem' }}>
              {slidesData[currentSlide].title}
            </h2>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>
              {slidesData[currentSlide].meta}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: '850px' }}>
              {slidesData[currentSlide].description}
            </p>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem', animation: 'slideFade 0.4s ease' }} key={`btn-${currentSlide}`}>
            <button
              onClick={() => {
                setSuccessModalContent(slidesData[currentSlide].successMsg);
                setShowSuccessModal(true);
              }}
              className="btn-hover"
              style={{
                backgroundColor: 'var(--navy-900)',
                color: 'var(--white)',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.95rem',
                boxShadow: '0 4px 6px -1px rgba(23, 37, 84, 0.15)',
                whiteSpace: 'nowrap'
              }}
            >
              {slidesData[currentSlide].buttonText}
            </button>
          </div>
        </div>

        {/* Slide Indicator Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginTop: '1.25rem' }}>
          {slidesData.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: currentSlide === idx ? 'var(--navy-900)' : 'var(--border-color)',
                padding: 0,
                transition: 'background-color 0.25s ease',
                border: 'none',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      </div>

      {/* Stats Counter Grid */}
      <div className="dashboard-grid">
        {stats.map((stat, idx) => (
          <Link 
            key={idx} 
            to={stat.path}
            className="card-hover"
            style={{
              backgroundColor: 'var(--white)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                {stat.label}
              </span>
              <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-dark)', marginTop: '0.25rem' }}>
                {stat.value}
              </h3>
            </div>
            <div 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: stat.bg,
                color: stat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {stat.icon}
            </div>
          </Link>
        ))}
      </div>

      {/* Main Dashboard Layout Splits */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr 1fr', 
          gap: '1.5rem',
          alignItems: 'start'
        }}
        className="dashboard-split"
      >
        {/* Left Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Projects and Creation Box */}
          <div 
            style={{ 
              backgroundColor: 'var(--white)', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={18} />
                <span>Active Research Projects</span>
              </h3>
              <Link to="/projects" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-800)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>View all</span>
                <ArrowRight size={14} />
              </Link>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentProjects.map((proj) => (
                <div 
                  key={proj.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--off-white)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                      {proj.name}
                    </h4>
                    <Badge text={proj.status} />
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {proj.description.length > 90 ? `${proj.description.substring(0, 90)}...` : proj.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Progress slider bar */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>
                        <span>Progress</span>
                        <span>{proj.progress}%</span>
                      </div>
                      <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${proj.progress}%`, backgroundColor: 'var(--navy-900)', borderRadius: '3px' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                      <div>Deadline</div>
                      <strong style={{ color: 'var(--text-dark)' }}>{proj.deadline}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabbed Approvals Panel if Admin or Mentor */}
          {['Mentor', 'Admin'].includes(activeRole) && (
            <div 
              style={{ 
                backgroundColor: 'var(--white)', 
                borderRadius: '0.75rem', 
                padding: '1.5rem', 
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckSquare size={18} />
                  <span>Pending Approvals</span>
                </h3>
                <Link to="/approvals" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-800)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>Manage Approvals</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingApprovals.length > 0 ? (
                  pendingApprovals.map((app) => (
                    <div 
                      key={app.id}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      className="row-hover"
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--navy-800)', backgroundColor: 'var(--sky-100)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                            {app.type}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.dateSubmitted}</span>
                        </div>
                        <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)', marginTop: '0.25rem' }}>
                          {app.title}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Submitted by {app.submittedBy} ({app.club})
                        </div>
                      </div>
                      <Link 
                        to="/approvals"
                        className="btn-hover"
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--navy-900)',
                          color: 'var(--white)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.375rem'
                        }}
                      >
                        Action
                      </Link>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No pending approval requests.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Upcoming Events Box */}
          <div 
            style={{ 
              backgroundColor: 'var(--white)', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyStyle: 'space-between', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} />
                <span>Upcoming Events</span>
              </h3>
              <Link to="/events" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-800)' }}>
                View all
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {upcomingEvents.map((evt) => (
                <div 
                  key={evt.id}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'start'
                  }}
                >
                  {/* Date square card */}
                  <div 
                    style={{
                      width: '50px',
                      height: '50px',
                      backgroundColor: 'var(--navy-900)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--white)',
                      flexShrink: 0
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--sky-200)', lineHeight: 1 }}>
                      {new Date(evt.date).toLocaleString('default', { month: 'short' })}
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.1 }}>
                      {new Date(evt.date).getDate()}
                    </span>
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)', lineHeight: 1.2 }}>
                      {evt.name}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {evt.time} • {evt.venue}
                    </span>
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--navy-800)', marginTop: '0.125rem' }}>
                      By {evt.organizer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Box */}
          <div 
            style={{ 
              backgroundColor: 'var(--white)', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Activity size={18} />
              <span>Recent Activity</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              {/* Connecting vertical timeline line */}
              <div 
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '8px',
                  bottom: '20px',
                  width: '2px',
                  backgroundColor: 'var(--border-color)',
                  zIndex: 1
                }}
              />
              
              {mockRecentActivities.map((act) => (
                <div 
                  key={act.id}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'start',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  <div 
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--white)',
                      border: '2px solid var(--navy-900)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--navy-900)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', lineHeight: 1.3 }}>
                      {act.text}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {act.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Slideshow Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Action Confirmed"
      >
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div 
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#d1fae5',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: '1.75rem',
              fontWeight: 'bold'
            }}
          >
            ✓
          </div>
          <p style={{ fontSize: '1rem', color: 'var(--text-dark)', lineHeight: 1.5, marginBottom: '2rem' }}>
            {successModalContent}
          </p>
          <button
            onClick={() => setShowSuccessModal(false)}
            className="btn-hover"
            style={{
              backgroundColor: 'var(--navy-900)',
              color: 'var(--white)',
              padding: '0.65rem 2rem',
              borderRadius: '0.375rem',
              fontWeight: 600
            }}
          >
            Dismiss
          </button>
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 1024px) {
          .dashboard-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
    </div>
  );
};

export default Dashboard;
