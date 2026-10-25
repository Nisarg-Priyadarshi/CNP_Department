import { useState, useEffect, useRef, type FormEvent } from 'react';
import { api } from '../../services/api';
import '../../pages/Events/events.css';

export interface EventFormProps {
  clubId?: string;
  availableClubs?: any[];
  event?: any;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * The event form. Rendered by the Events page inside a `.ui-modal` whose head
 * it does not own; the body and the foot are the form's own composition.
 * Fields, validation, payload and edit mode are unchanged.
 */
export function EventForm({ clubId, availableClubs, event, onSave, onCancel }: EventFormProps) {
  const initialClubId =
    clubId ||
    (event?.clubId && typeof event.clubId === 'object' ? event.clubId._id : event?.clubId) ||
    (availableClubs && availableClubs.length === 1 ? availableClubs[0]._id : '') ||
    '';

  const [selectedClubId, setSelectedClubId] = useState<string>(initialClubId);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    eventLink: '',
    eventLinkName: '',
    relatedDocumentName: '',
  });

  const [file, setFile] = useState<File | null>(null);
  const [removeDocument, setRemoveDocument] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (event) {
      const eventTime = event.eventDate || event.date;
      let dateVal = '';
      let timeVal = '';
      if (eventTime) {
        const d = new Date(eventTime);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateVal = `${year}-${month}-${day}`;
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          timeVal = `${hours}:${minutes}`;
        }
      }
      setFormData({
        title: event.title || '',
        description: event.description || '',
        date: dateVal,
        time: timeVal,
        location: event.location || '',
        eventLink: event.eventLink || '',
        eventLinkName: event.eventLinkName || '',
        relatedDocumentName: event.relatedDocumentName || '',
      });
      const cId = typeof event.clubId === 'object' ? event.clubId?._id : event.clubId;
      if (cId) setSelectedClubId(cId);
      setRemoveDocument(false);
      setFile(null);
    } else {
      if (clubId) setSelectedClubId(clubId);
      else if (availableClubs && availableClubs.length === 1) setSelectedClubId(availableClubs[0]._id);
    }
  }, [event, clubId, availableClubs]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const targetClubId = selectedClubId || clubId;
    if (!targetClubId) {
      setError('Please select a club for this event');
      setLoading(false);
      return;
    }

    if (!formData.date) {
      setError('Event date is required');
      setLoading(false);
      return;
    }

    const timePart = formData.time ? formData.time : '09:00';
    const parsedDate = new Date(`${formData.date}T${timePart}`);
    if (isNaN(parsedDate.getTime())) {
      setError('Invalid date or time value');
      setLoading(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append('title', formData.title.trim());
      fd.append('description', formData.description.trim());
      fd.append('location', formData.location.trim());
      fd.append('clubId', targetClubId);
      fd.append('eventDate', parsedDate.toISOString());

      if (formData.eventLink && formData.eventLink.trim()) {
        const trimmedLink = formData.eventLink.trim();
        if (!trimmedLink.startsWith('http://') && !trimmedLink.startsWith('https://')) {
          setError('Event link must start with http:// or https://');
          setLoading(false);
          return;
        }
        fd.append('eventLink', trimmedLink);
      } else {
        fd.append('eventLink', '');
      }

      if (formData.eventLinkName) fd.append('eventLinkName', formData.eventLinkName.trim());
      if (formData.relatedDocumentName) fd.append('relatedDocumentName', formData.relatedDocumentName.trim());

      if (file) {
        fd.append('relatedDocument', file);
      } else if (removeDocument) {
        fd.append('removeDocument', 'true');
      }

      if (event) {
        await api('PUT', `/events/${event._id}`, fd);
      } else {
        await api('POST', '/events', fd);
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="evt-form" onSubmit={handleSubmit}>
      <div className="ui-modal__body evt-form__body">
        {error && (
          <p className="ui-notice ui-notice--error" role="alert">
            <svg className="evt-i evt-i--sm" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.8v4.6M12 16.1v.2" />
            </svg>
            {error}
          </p>
        )}

        {availableClubs && availableClubs.length > 1 && !event && (
          <div>
            <label className="ui-label" htmlFor="evt-field-club">
              Organising club
            </label>
            <select
              id="evt-field-club"
              className="ui-field ui-field--select"
              value={selectedClubId}
              onChange={e => setSelectedClubId(e.target.value)}
              required
            >
              <option value="" disabled>
                Choose a club
              </option>
              {availableClubs.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="ui-label" htmlFor="evt-field-title">
            Title
          </label>
          <input
            id="evt-field-title"
            className="ui-field"
            type="text"
            placeholder="e.g. Photography walk"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            autoFocus
            required
          />
        </div>

        <div className="evt-form__grid">
          <div>
            <label className="ui-label" htmlFor="evt-field-date">
              Date
            </label>
            <input
              id="evt-field-date"
              className="ui-field"
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="ui-label" htmlFor="evt-field-time">
              Starts
            </label>
            <input
              id="evt-field-time"
              className="ui-field"
              type="time"
              value={formData.time}
              onChange={e => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="ui-label" htmlFor="evt-field-location">
            Venue
          </label>
          <input
            id="evt-field-location"
            className="ui-field"
            type="text"
            placeholder="e.g. Seminar hall 2, campus"
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            required
          />
        </div>

        <div className="evt-form__grid">
          <div>
            <label className="ui-label" htmlFor="evt-field-link-name">
              Link label
            </label>
            <input
              id="evt-field-link-name"
              className="ui-field"
              type="text"
              placeholder="e.g. Registration"
              value={formData.eventLinkName}
              onChange={e => setFormData({ ...formData, eventLinkName: e.target.value })}
            />
          </div>
          <div>
            <label className="ui-label" htmlFor="evt-field-link">
              Link URL
            </label>
            <input
              id="evt-field-link"
              className="ui-field"
              type="url"
              placeholder="https://"
              value={formData.eventLink}
              onChange={e => setFormData({ ...formData, eventLink: e.target.value })}
            />
          </div>
        </div>

        <div className="evt-form__grid">
          <div>
            <label className="ui-label" htmlFor="evt-field-doc-name">
              Document label
            </label>
            <input
              id="evt-field-doc-name"
              className="ui-field"
              type="text"
              placeholder="e.g. Event guidelines"
              value={formData.relatedDocumentName}
              onChange={e => setFormData({ ...formData, relatedDocumentName: e.target.value })}
            />
          </div>
          <div>
            <label className="ui-label" htmlFor="evt-field-doc">
              Related document
            </label>
            {event?.relatedDocument?.url && !removeDocument && !file && (
              <div className="evt-form__doc">
                <svg className="evt-i evt-i--sm" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V8.5L13 3.5Z" />
                  <path d="M13 3.5V8.5H18" />
                </svg>
                <span className="evt-form__docname">
                  {event.relatedDocumentName || event.relatedDocument.originalName || 'Document'}
                </span>
                <button
                  type="button"
                  className="ui-btn ui-btn--quiet ui-btn--sm"
                  onClick={() => setRemoveDocument(true)}
                >
                  Remove
                </button>
              </div>
            )}
            <input
              id="evt-field-doc"
              className="evt-file"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              ref={fileInputRef}
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) {
                  setFile(e.target.files[0]);
                  setRemoveDocument(false);
                } else {
                  setFile(null);
                }
              }}
            />
            <p className="ui-hint">PDF or DOC, up to the server limit.</p>
          </div>
        </div>

        <div>
          <label className="ui-label" htmlFor="evt-field-description">
            Description
          </label>
          <textarea
            id="evt-field-description"
            className="ui-field ui-field--area"
            rows={4}
            placeholder="What happens, who it is for, what to bring."
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="ui-modal__foot">
        <span className="ui-grow" />
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={loading}>
          {loading ? 'Saving...' : event ? 'Update event' : 'Create event'}
        </button>
      </div>
    </form>
  );
}
