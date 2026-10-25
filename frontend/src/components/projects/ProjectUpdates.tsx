import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Counter } from '../ui/vis';

interface ProjectUpdatesProps {
  projectId: string;
  projectName?: string;
  isTL?: boolean;
  mentors?: any[];
}

function initialOf(name?: string): string {
  return (name || '?').replace(/^Dr\.\s*/i, '').trim().charAt(0).toUpperCase() || '?';
}

const MessageMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5v-3.5a2 2 0 0 1-1-1.7v-8Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>
);

const FileMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 3.5h7l4 4V20.5H7V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

export function ProjectUpdates({ projectId, projectName: propProjectName, isTL, mentors: propMentors }: ProjectUpdatesProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>(propMentors || []);
  const [projectMeta, setProjectMeta] = useState<{ id?: string; name?: string; status?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (propMentors) {
      setMentors(propMentors);
    }
  }, [propMentors]);

  // Update creation form state (Team Leader only)
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateDesc, setUpdateDesc] = useState('');
  const [updateFiles, setUpdateFiles] = useState<FileList | null>(null);
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Feedback form state
  const [activeFeedbackUpdateId, setActiveFeedbackUpdateId] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState<{ [updateId: string]: string }>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<{ [updateId: string]: boolean }>({});
  const [feedbackErrors, setFeedbackErrors] = useState<{ [updateId: string]: string }>({});
  const [feedbackSuccess, setFeedbackSuccess] = useState<{ [updateId: string]: string }>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const promises: [Promise<any>, Promise<any>, Promise<any>?] = [
          api<any>('GET', `/projects/${projectId}/updates`).catch((e) => {
            if (e.status !== 403) throw e;
            return { data: [] };
          }),
          api<any>('GET', `/projects/${projectId}/feedback`).catch((e) => {
            if (e.status !== 403) throw e;
            return { data: [] };
          }),
        ];

        if (!propMentors) {
          promises.push(api<any>('GET', `/projects/${projectId}/mentors`).catch(() => ({ data: [] })));
        }

        const [updRes, fbRes, mentorsRes] = await Promise.all(promises);
        setUpdates(updRes.data || []);
        setFeedback(fbRes.data || []);
        if (mentorsRes?.data) {
          setMentors(mentorsRes.data);
        }
        if (updRes.project) {
          setProjectMeta(updRes.project);
        } else if (fbRes.project) {
          setProjectMeta(fbRes.project);
        }
      } catch (err: any) {
        if (err.status !== 403) {
          setError(err.message || 'Failed to load updates/feedback');
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  // Authorization checks
  const isProjectAdmin = user?.role === 'project_admin';
  const isAssignedMentor =
    user?.role === 'faculty_mentor' &&
    mentors.some((m: any) => {
      const mentorUser = m.mentorId;
      const mId = typeof mentorUser === 'object' ? mentorUser?._id : mentorUser;
      return mId === user?._id;
    });
  const canGiveFeedback = isProjectAdmin || isAssignedMentor;
  const currentProjectName = propProjectName || projectMeta?.name || 'Project';

  const handleOpenFeedbackForm = (updateId: string) => {
    setActiveFeedbackUpdateId(updateId);
    setFeedbackErrors((prev) => ({ ...prev, [updateId]: '' }));
    setFeedbackSuccess((prev) => ({ ...prev, [updateId]: '' }));
  };

  const handleCancelFeedback = (updateId: string) => {
    setActiveFeedbackUpdateId(null);
    setFeedbackErrors((prev) => ({ ...prev, [updateId]: '' }));
    setFeedbackSuccess((prev) => ({ ...prev, [updateId]: '' }));
  };

  const handleFeedbackSubmit = async (updateId: string) => {
    const text = feedbackInput[updateId]?.trim();
    if (!text) {
      setFeedbackErrors((prev) => ({ ...prev, [updateId]: 'Feedback text is required and cannot be empty.' }));
      return;
    }

    try {
      setSubmittingFeedback((prev) => ({ ...prev, [updateId]: true }));
      setFeedbackErrors((prev) => ({ ...prev, [updateId]: '' }));

      const res = await api<any>('POST', `/projects/${projectId}/feedback`, {
        updateId,
        feedbackText: text,
      });

      // Update feedback section immediately without page reload
      if (res.data) {
        setFeedback((prev) => [res.data, ...prev.filter((fb) => fb._id !== res.data._id)]);
      }

      setFeedbackSuccess((prev) => ({ ...prev, [updateId]: 'Feedback submitted successfully!' }));
      setFeedbackInput((prev) => ({ ...prev, [updateId]: '' }));

      // Reload feedback in background to ensure complete server sync
      api<any>('GET', `/projects/${projectId}/feedback`)
        .then((fbRes) => {
          if (fbRes.data) {
            setFeedback(fbRes.data);
          }
        })
        .catch(() => {});

      // Close the form after a short delay so user sees success state
      setTimeout(() => {
        setActiveFeedbackUpdateId((current) => (current === updateId ? null : current));
        setFeedbackSuccess((prev) => ({ ...prev, [updateId]: '' }));
      }, 1500);
    } catch (e: any) {
      setFeedbackErrors((prev) => ({ ...prev, [updateId]: e.message || 'Failed to submit feedback' }));
    } finally {
      setSubmittingFeedback((prev) => ({ ...prev, [updateId]: false }));
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTitle.trim() || !updateDesc.trim()) return;

    try {
      setSubmittingUpdate(true);
      const formData = new FormData();
      formData.append('title', updateTitle);
      formData.append('description', updateDesc);

      if (updateFiles) {
        for (let i = 0; i < updateFiles.length; i++) {
          formData.append('files', updateFiles[i]);
        }
      }

      await api('POST', `/projects/${projectId}/updates`, formData);
      alert('Update submitted successfully');
      setShowUpdateForm(false);
      setUpdateTitle('');
      setUpdateDesc('');
      setUpdateFiles(null);

      const updRes = await api<any>('GET', `/projects/${projectId}/updates`);
      setUpdates(updRes.data || []);
      if (updRes.project) setProjectMeta(updRes.project);
    } catch (err: any) {
      alert(err.message || 'Failed to submit update');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  if (loading) return null;
  if (error) {
    return (
      <div className="ui-notice ui-notice--error" role="alert">
        {error}
      </div>
    );
  }

  return (
    <section className="ui-panel ui-panel--accent prj-updates" aria-labelledby="prj-updates-title">
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title" id="prj-updates-title">
            Updates
          </h2>
          <span className="ui-panel__meta">
            <Counter value={updates.length} />
          </span>
        </div>
        {isTL && (
          <button
            type="button"
            className={showUpdateForm ? 'ui-btn ui-btn--ghost ui-btn--sm' : 'ui-btn ui-btn--primary ui-btn--sm'}
            onClick={() => setShowUpdateForm(!showUpdateForm)}
          >
            {showUpdateForm ? 'Cancel' : 'Post update'}
          </button>
        )}
      </header>

      <div className="ui-panel__body">
        {showUpdateForm && (
          <form className="prj-update-form" onSubmit={handleUpdateSubmit}>
            <div className="prj-update-form__grid">
              <div>
                <label className="ui-label" htmlFor="prj-update-title">
                  Title
                </label>
                <input
                  id="prj-update-title"
                  type="text"
                  className="ui-field"
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  required
                  disabled={submittingUpdate}
                  placeholder="What moved this week?"
                />
              </div>
            </div>
            <div>
              <label className="ui-label" htmlFor="prj-update-body">
                Description
              </label>
              <textarea
                id="prj-update-body"
                className="ui-field ui-field--area"
                value={updateDesc}
                onChange={(e) => setUpdateDesc(e.target.value)}
                required
                disabled={submittingUpdate}
                rows={4}
                placeholder="Progress, blockers, and what the team needs next."
              />
            </div>
            <div>
              <label className="ui-label" htmlFor="prj-update-files">
                Attachments <span className="prj-label__hint">optional, up to 5 files</span>
              </label>
              <input
                id="prj-update-files"
                type="file"
                multiple
                onChange={(e) => setUpdateFiles(e.target.files)}
                disabled={submittingUpdate}
                className="prj-file"
              />
            </div>
            <div className="prj-update-form__actions">
              <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" disabled={submittingUpdate}>
                {submittingUpdate ? 'Submitting…' : 'Submit update'}
              </button>
            </div>
          </form>
        )}

        {updates.length ? (
          <ol className="prj-timeline">
            {updates.map((upd, index) => {
              const updateFeedbacks = feedback.filter(
                (fb) => fb.updateId?._id === upd._id || fb.updateId === upd._id,
              );
              const hasFeedback = updateFeedbacks.length > 0;
              const isFormOpen = activeFeedbackUpdateId === upd._id;

              return (
                <li
                  key={upd._id}
                  id={`update-${upd._id}`}
                  className={`prj-timeline__item${index === 0 ? ' is-latest' : ''}`}
                  style={{ '--i': Math.min(7, index) } as CSSProperties}
                >
                  <span
                    className={`prj-timeline__node${index === 0 ? ' is-latest' : ''}`}
                    aria-hidden="true"
                  />
                  <div className="prj-timeline__body">
                    <div className="prj-timeline__head">
                      <h3 className="prj-timeline__title">{upd.title}</h3>
                      <time className="prj-timeline__date" dateTime={upd.createdAt}>
                        {new Date(upd.createdAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>

                    <div className="prj-timeline__by">
                      {upd.studentId ? (
                        <>
                          <span className="ui-avatar ui-avatar--sm prj-avatar" aria-hidden="true">
                            {initialOf(upd.studentId.name)}
                          </span>
                          <span>{upd.studentId.name}</span>
                          <span className="prj-timeline__role">Team</span>
                        </>
                      ) : (
                        <span>Unknown author</span>
                      )}
                    </div>

                    <p className="prj-timeline__text">{upd.description}</p>

                    {upd.files && upd.files.length > 0 && (
                      <div className="prj-timeline__files">
                        {upd.files.map((file: any, i: number) => (
                          <a
                            key={i}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="prj-file-chip"
                          >
                            <FileMark />
                            View file {i + 1}
                          </a>
                        ))}
                      </div>
                    )}

                    {(hasFeedback || canGiveFeedback) && (
                    <div className="prj-feedback">
                      <div className="prj-feedback__head">
                        <span className="prj-feedback__label">
                          Mentor feedback
                          {hasFeedback && <span className="ui-count">{updateFeedbacks.length}</span>}
                        </span>
                        {canGiveFeedback && !isFormOpen && (
                          <button
                            id={`${hasFeedback ? 'add' : 'give'}-feedback-btn-${upd._id}`}
                            type="button"
                            className="ui-btn ui-btn--quiet ui-btn--sm"
                            onClick={() => handleOpenFeedbackForm(upd._id)}
                          >
                            {hasFeedback ? 'Add feedback' : 'Give feedback'}
                          </button>
                        )}
                      </div>

                      {hasFeedback && (
                        <ul className="prj-feedback__list">
                          {updateFeedbacks.map((fb) => {
                            const authorRole =
                              fb.mentorId?.role === 'project_admin'
                                ? 'Project admin'
                                : fb.mentorId?.role === 'faculty_mentor'
                                  ? 'Faculty mentor'
                                  : fb.mentorId?.role || 'Mentor';
                            return (
                              <li key={fb._id} className="prj-feedback__item">
                                <span className="ui-avatar ui-avatar--sm prj-avatar" aria-hidden="true">
                                  {initialOf(fb.mentorId?.name)}
                                </span>
                                <div className="prj-feedback__main">
                                  <div className="prj-feedback__who">
                                    <span className="prj-feedback__name">{fb.mentorId?.name || 'Unknown author'}</span>
                                    <span className="ui-tag ui-tag--plain prj-feedback__role">{authorRole}</span>
                                    <span className="ui-meta prj-feedback__when">
                                      {new Date(fb.createdAt).toLocaleString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  <p className="prj-feedback__text">{fb.feedbackText}</p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {isFormOpen && (
                        <form
                          id={`feedback-form-${upd._id}`}
                          className="prj-feedback__form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleFeedbackSubmit(upd._id);
                          }}
                        >
                          <div className="prj-feedback__form-head">
                            <p className="prj-feedback__form-title">
                              {hasFeedback ? 'Add feedback' : 'Give feedback'}
                            </p>
                            <span className="ui-tag ui-tag--plain">
                              {user?.role === 'project_admin' ? 'Project admin' : 'Faculty mentor'}
                            </span>
                          </div>
                          <p className="ui-meta">
                            On “{upd.title}” · {upd.studentId?.name || 'Unknown'} · {currentProjectName}
                          </p>

                          {feedbackSuccess[upd._id] && (
                            <div className="ui-notice prj-notice--ok prj-feedback__notice" role="status">
                              {feedbackSuccess[upd._id]}
                            </div>
                          )}
                          {feedbackErrors[upd._id] && (
                            <div className="ui-notice ui-notice--error prj-feedback__notice" role="alert">
                              {feedbackErrors[upd._id]}
                            </div>
                          )}

                          <label className="ui-label" htmlFor={`feedback-input-${upd._id}`}>
                            Feedback
                          </label>
                          <textarea
                            id={`feedback-input-${upd._id}`}
                            className="ui-field ui-field--area prj-feedback__input"
                            value={feedbackInput[upd._id] || ''}
                            onChange={(e) => {
                              setFeedbackInput((prev) => ({ ...prev, [upd._id]: e.target.value }));
                              if (feedbackErrors[upd._id]) {
                                setFeedbackErrors((prev) => ({ ...prev, [upd._id]: '' }));
                              }
                            }}
                            placeholder="What should the team do next?"
                            rows={3}
                            disabled={submittingFeedback[upd._id]}
                            required
                          />

                          <div className="prj-feedback__actions">
                            <button
                              id={`submit-feedback-btn-${upd._id}`}
                              type="submit"
                              className="ui-btn ui-btn--primary ui-btn--sm"
                              disabled={submittingFeedback[upd._id]}
                            >
                              {submittingFeedback[upd._id] ? 'Submitting…' : 'Submit feedback'}
                            </button>
                            <button
                              id={`cancel-feedback-btn-${upd._id}`}
                              type="button"
                              className="ui-btn ui-btn--ghost ui-btn--sm"
                              disabled={submittingFeedback[upd._id]}
                              onClick={() => handleCancelFeedback(upd._id)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="ui-empty">
            <span className="ui-empty__mark">
              <MessageMark />
            </span>
            <p className="ui-empty__title">No updates yet</p>
            <p className="ui-empty__text">
              {isTL
                ? 'Post the first update so mentors can follow the work.'
                : 'The team leader posts progress here.'}
            </p>
            {isTL && !showUpdateForm && (
              <button
                type="button"
                className="ui-btn ui-btn--primary ui-btn--sm"
                onClick={() => setShowUpdateForm(true)}
              >
                Post update
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
