import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import '../../pages/Clubs/clubs.css';

export function ClubForm({ onSave, onCancel }: { onSave: () => void, onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api('POST', '/clubs', { name, description });
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to create club');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="ui-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-create-title">
        <div className="ui-modal__head">
          <div>
            <h2 id="clubs-create-title" className="ui-panel__title">New club</h2>
          </div>
          <button type="button" className="ui-icon-btn" onClick={onCancel} disabled={saving} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ui-modal__body clubs-modal__body">
            {error && <div className="ui-notice ui-notice--error clubs-modal__error" role="alert">{error}</div>}

            <div>
              <label className="ui-label" htmlFor="club-name">Club name</label>
              <input
                id="club-name"
                ref={nameRef}
                type="text"
                className="ui-field"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Robotics Club"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label className="ui-label" htmlFor="club-description">Description</label>
              <textarea
                id="club-description"
                className="ui-field ui-field--area"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does the club do, and who should join?"
                required
                rows={4}
                disabled={saving}
              />
            </div>
          </div>

          <div className="ui-modal__foot">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
