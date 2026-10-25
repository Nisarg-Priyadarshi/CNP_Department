import { useEffect, useId, useState } from 'react';
import { api } from '../../services/api';

export function ProjectForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fieldId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [loading, onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('POST', '/projects', formData);
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="ui-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-title`}
      >
        <header className="ui-modal__head">
          <div>
            <h2 className="ui-h2" id={`${fieldId}-title`}>
              New project
            </h2>
          </div>
          <button
            type="button"
            className="ui-icon-btn"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="ui-modal__body ui-stack">
            {error && (
              <div className="ui-notice ui-notice--error" role="alert">
                {error}
              </div>
            )}

            <div className="ui-form-row ui-form-row--2">
              <div>
                <label className="ui-label" htmlFor={`${fieldId}-name`}>
                  Project name
                </label>
                <input
                  id={`${fieldId}-name`}
                  type="text"
                  className="ui-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                  placeholder="e.g. AI Research Drone"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="ui-label" htmlFor={`${fieldId}-status`}>
                  Initial status
                </label>
                <select
                  id={`${fieldId}-status`}
                  className="ui-field ui-field--select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={loading}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="ui-label" htmlFor={`${fieldId}-description`}>
                Description
              </label>
              <textarea
                id={`${fieldId}-description`}
                className="ui-field ui-field--area"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                placeholder="What is the team building, and what does done look like?"
                disabled={loading}
              />
            </div>
          </div>

          <footer className="ui-modal__foot">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="ui-btn ui-btn--primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
