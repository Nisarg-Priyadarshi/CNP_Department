import React, { useState, useMemo } from 'react';
import { mockApprovals } from '../data/mockData';
import { useUser } from '../context/UserContext';
import { Check, X, Eye, FileText, CheckCircle, ShieldAlert } from 'lucide-react';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const Approvals = () => {
  const { activeRole } = useUser();
  const [approvals, setApprovals] = useState(mockApprovals);
  
  // Tab states: 'Event Request', 'Club Audit', 'Project Submission', 'Inventory Request'
  const [activeTab, setActiveTab] = useState('Event Request');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const tabs = [
    { id: 'Event Request', label: 'Event Requests' },
    { id: 'Club Audit', label: 'Club Audits' },
    { id: 'Project Submission', label: 'Project Submissions' },
    { id: 'Inventory Request', label: 'Inventory Requests' }
  ];

  const filteredApprovals = useMemo(() => {
    return approvals.filter(app => app.type === activeTab);
  }, [approvals, activeTab]);

  const handleStatusChange = (id, newStatus) => {
    const updated = approvals.map(app => 
      app.id === id ? { ...app, status: newStatus } : app
    );
    setApprovals(updated);
    
    // Update selected modal item if open
    if (selectedApproval && selectedApproval.id === id) {
      setSelectedApproval({ ...selectedApproval, status: newStatus });
    }
  };

  const isAuthorized = ['Admin', 'Mentor'].includes(activeRole);

  if (!isAuthorized) {
    return (
      <div 
        className="page-enter page-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center'
        }}
      >
        <div 
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem'
          }}
        >
          <ShieldAlert size={40} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy-900)' }}>
          Access Denied
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Approvals management is restricted to department Faculty Mentors and Administrators. Please use the simulator switcher in the top header to change your role.
        </p>
      </div>
    );
  }

  return (
    <div className="page-enter page-container">
      {/* Category Tabs */}
      <div 
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              color: activeTab === tab.id ? 'var(--navy-900)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--navy-900)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.2s ease'
            }}
            className="btn-hover"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Approvals Table */}
      <div className="table-wrapper">
        <table className="custom-table responsive-table">
          <thead>
            <tr>
              <th>Request Title</th>
              <th>Submitted By</th>
              <th>Club / Group</th>
              <th>Date Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredApprovals.length > 0 ? (
              filteredApprovals.map(app => (
                <tr key={app.id} className="row-hover">
                  <td data-label="Request Title" style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                    {app.title}
                  </td>
                  <td data-label="Submitted By">
                    {app.submittedBy}
                  </td>
                  <td data-label="Club / Group">
                    {app.club}
                  </td>
                  <td data-label="Date Submitted">
                    {app.dateSubmitted}
                  </td>
                  <td data-label="Status">
                    <Badge text={app.status} />
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', md: 'flex-start' }} className="actions-wrapper">
                      <button
                        onClick={() => {
                          setSelectedApproval(app);
                          setIsModalOpen(true);
                        }}
                        title="View Details"
                        className="btn-hover"
                        style={{
                          padding: '0.4rem',
                          borderRadius: '0.375rem',
                          backgroundColor: 'var(--off-white)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-dark)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Eye size={16} />
                      </button>

                      {app.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(app.id, 'Approved')}
                            title="Approve"
                            className="btn-hover"
                            style={{
                              padding: '0.4rem',
                              borderRadius: '0.375rem',
                              backgroundColor: '#d1fae5',
                              border: '1px solid #a7f3d0',
                              color: '#065f46',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleStatusChange(app.id, 'Rejected')}
                            title="Reject"
                            className="btn-hover"
                            style={{
                              padding: '0.4rem',
                              borderRadius: '0.375rem',
                              backgroundColor: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#991b1b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No requests found in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Request Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Audit Details — ${selectedApproval?.type}`}
      >
        {selectedApproval && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                  {selectedApproval.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Submitted on {selectedApproval.dateSubmitted}
                </span>
              </div>
              <Badge text={selectedApproval.status} />
            </div>

            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1rem', 
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                backgroundColor: 'var(--off-white)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>SUBMITTER:</span>
                <strong>{selectedApproval.submittedBy}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>CLUB / ORG:</span>
                <strong>{selectedApproval.club}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                SUBMISSION ABSTRACT / DETAILS:
              </span>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                {selectedApproval.details}
              </p>
            </div>

            <div 
              style={{ 
                borderTop: '1px solid var(--border-color)', 
                paddingTop: '1.5rem', 
                display: 'flex', 
                gap: '1rem', 
                justifyContent: 'flex-end' 
              }}
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-hover"
                style={{
                  border: '1px solid var(--border-color)',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.375rem',
                  fontWeight: 600
                }}
              >
                Close
              </button>

              {selectedApproval.status === 'Pending' && (
                <>
                  <button
                    onClick={() => handleStatusChange(selectedApproval.id, 'Rejected')}
                    className="btn-hover"
                    style={{
                      backgroundColor: 'var(--danger)',
                      color: 'var(--white)',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '0.375rem',
                      fontWeight: 600
                    }}
                  >
                    Reject Request
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedApproval.id, 'Approved')}
                    className="btn-hover"
                    style={{
                      backgroundColor: 'var(--success)',
                      color: 'var(--white)',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '0.375rem',
                      fontWeight: 600
                    }}
                  >
                    Approve Request
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .actions-wrapper {
            justify-content: flex-end !important;
          }
        }
      `}} />
    </div>
  );
};

export default Approvals;
