import React, { useState, useMemo } from 'react';
import { mockProjects } from '../data/mockData';
import { useUser } from '../context/UserContext';
import { Search, FolderGit2, Calendar, ClipboardCheck, Plus, CheckCircle2 } from 'lucide-react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const Projects = () => {
  const { activeRole } = useUser();
  const [projects, setProjects] = useState(mockProjects);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formTeam, setFormTeam] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.department.toLowerCase().includes(search.toLowerCase()) ||
        p.team.some(member => member.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!formName || !formDept || !formTeam) return;

    const newProject = {
      id: `proj-${Date.now()}`,
      name: formName,
      team: formTeam.split(',').map(name => name.trim()),
      department: formDept,
      status: 'Submitted',
      progress: 0,
      deadline: formDeadline || '2026-12-31',
      description: formDesc || 'No project description.'
    };

    setProjects([newProject, ...projects]);
    setIsModalOpen(false);

    // Reset form
    setFormName('');
    setFormDept('');
    setFormTeam('');
    setFormDeadline('');
    setFormDesc('');
  };

  return (
    <div className="page-enter page-container">
      {/* Search and Filters */}
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
          {/* Search Input */}
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
              placeholder="Search by project name, member, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Status filter selector */}
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="All">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {/* Submit Project Button */}
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
          <span>Propose Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {filteredProjects.length > 0 ? (
          filteredProjects.map(proj => (
            <div 
              key={proj.id}
              className="card-hover"
              style={{
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FolderGit2 size={20} style={{ color: 'var(--navy-900)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {proj.department}
                    </span>
                  </div>
                  <Badge text={proj.status} />
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                  {proj.name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                  {proj.description || 'No description provided.'}
                </p>

                {/* Team Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    TEAM MEMBERS:
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {proj.team.map((member, idx) => (
                      <span 
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          backgroundColor: 'var(--sky-50)',
                          color: 'var(--navy-900)',
                          border: '1px solid var(--sky-200)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.25rem'
                        }}
                      >
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Progress and Deadlines */}
              <div 
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>Project Progress</span>
                    <strong>{proj.progress}%</strong>
                  </div>
                  <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${proj.progress}%`, 
                        backgroundColor: proj.status === 'Completed' ? 'var(--success)' : 'var(--navy-900)',
                        borderRadius: '3px',
                        transition: 'width 0.5s ease' 
                      }} 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={14} />
                    <span>Deadline: <strong style={{ color: 'var(--text-dark)' }}>{proj.deadline}</strong></span>
                  </div>
                  {proj.status === 'Completed' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)', fontWeight: 600 }}>
                      <ClipboardCheck size={14} />
                      <span>Verified</span>
                    </div>
                  )}
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
            No projects registered matching your query filters.
          </div>
        )}
      </div>

      {/* Propose Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Propose New Department Project"
      >
        <form onSubmit={handleCreateProject}>
          <div className="form-group">
            <label className="form-label" htmlFor="proj-name">Project Title *</label>
            <input
              id="proj-name"
              type="text"
              className="form-input"
              placeholder="e.g. Smart Lab Automation"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="proj-dept">Department/Branch *</label>
              <input
                id="proj-dept"
                type="text"
                className="form-input"
                placeholder="e.g. Computer Science"
                value={formDept}
                onChange={(e) => setFormDept(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="proj-deadline">Estimated Deadline</label>
              <input
                id="proj-deadline"
                type="date"
                className="form-input"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="proj-team">Team Members (Comma separated names) *</label>
            <input
              id="proj-team"
              type="text"
              className="form-input"
              placeholder="Vedant Sharma, Sneha Reddy"
              value={formTeam}
              onChange={(e) => setFormTeam(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="proj-desc">Project Proposal/Abstract</label>
            <textarea
              id="proj-desc"
              className="form-input"
              rows="3"
              placeholder="Describe objectives, hardware/software stack, and target outcomes..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
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

export default Projects;
