/**
 * Task 2F — Project Updates & Mentor Feedback Frontend
 * Task 2G — Club Events Management Frontend
 *
 * Single-page application (vanilla TS + Vite).
 * Communicates with backend at http://localhost:5000.
 *
 * Roles supported for 2F:
 *   - student        → create updates, view updates, view feedback for own projects
 *   - faculty_mentor → view updates, add feedback for assigned projects
 *   - project_admin  → view updates + feedback for any project
 *
 * Roles supported for 2G:
 *   - student             → view upcoming events, view event details, view club events (read-only)
 *   - faculty_coordinator → create/edit/delete events for their assigned club
 *   - club_admin          → create/edit/delete events for any club
 *   - faculty_mentor      → view events (read-only)
 *   - project_admin       → view events (read-only)
 */

import './app.css';

const API = 'http://localhost:5000/api';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface Project { _id: string; name: string; description: string; status: string; }
interface ProjectUpdate {
  _id: string; projectId: { _id: string; name: string } | string;
  studentId: { _id: string; name: string; email: string } | string;
  title: string; description: string; files: unknown[]; createdAt: string; updatedAt: string;
}
interface ProjectFeedback {
  _id: string; projectId: string; mentorId: { _id: string; name: string; role: string };
  updateId: { _id: string; title: string } | null; feedbackText: string; createdAt: string;
}

interface Club { _id: string; name: string; description: string; facultyCoordinatorId?: string | { _id: string; name: string }; }

interface ClubEvent {
  _id: string;
  title: string;
  description: string;
  clubId: { _id: string; name: string } | string;
  eventDate: string;
  location: string;
  createdBy: { _id: string; name: string; role: string } | string;
  createdAt: string;
  updatedAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

// 2F state
let currentUserId    = '';
let currentRole      = 'student';
let currentProjectId = '';
let allProjects: Project[] = [];
let activeTab        = 'updates';

// 2G state
let allClubs: Club[]         = [];
let currentClubId            = '';
let eventsMainSection        = 'upcoming'; // 'upcoming' | 'manage' | 'club'
let mainSection              = 'projects'; // 'projects' | 'events'

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Request failed');
  return json as T;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatEventDate(iso: string) {
  const d = new Date(iso);
  return {
    day:   d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
    year:  d.toLocaleDateString('en-IN', { year: 'numeric' }),
    time:  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    full:  d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  };
}

function toLocalDatetimeInput(iso: string): string {
  // Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:MM)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isUpcoming(eventDate: string): boolean {
  return new Date(eventDate) >= new Date();
}

function roleBadge(role: string) {
  const cls = role === 'student' ? 'badge-student'
            : role === 'faculty_mentor' ? 'badge-mentor'
            : 'badge-admin';
  const label = role === 'faculty_mentor' ? 'Mentor' : role.replace('_', ' ');
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const container = document.getElementById('toast-container')!;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function setLoading(id: string, loading: boolean) {
  const el = document.getElementById(id);
  if (!el) return;
  if (loading) el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 2F FETCH HELPERS ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function fetchProjects(): Promise<Project[]> {
  const data = await api<{ data: Project[] }>('GET', '/projects');
  return data.data;
}

async function fetchStudentProjects(userId: string): Promise<Project[]> {
  const data = await api<{ data: { project: Project }[] }>('GET', `/users/${userId}/projects`);
  return data.data.map(d => d.project);
}

async function fetchMentorProjects(mentorId: string): Promise<Project[]> {
  const data = await api<{ data: { project: Project }[] }>('GET', `/mentors/${mentorId}/projects`);
  return data.data.map(d => d.project);
}

async function fetchUpdates(projectId: string, userId: string): Promise<ProjectUpdate[]> {
  const data = await api<{ data: ProjectUpdate[] }>('GET', `/projects/${projectId}/updates?userId=${userId}`);
  return data.data;
}

async function fetchFeedback(projectId: string, userId: string): Promise<ProjectFeedback[]> {
  const data = await api<{ data: ProjectFeedback[] }>('GET', `/projects/${projectId}/feedback?userId=${userId}`);
  return data.data;
}

async function fetchUpdateFeedback(projectId: string, updateId: string, userId: string): Promise<ProjectFeedback[]> {
  const data = await api<{ data: ProjectFeedback[] }>('GET', `/projects/${projectId}/updates/${updateId}/feedback?userId=${userId}`);
  return data.data;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 2G FETCH HELPERS ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function fetchClubs(): Promise<Club[]> {
  const data = await api<{ data: Club[] }>('GET', '/clubs');
  return data.data;
}

async function fetchUpcomingEvents(): Promise<ClubEvent[]> {
  const data = await api<{ data: ClubEvent[] }>('GET', '/events/upcoming');
  return data.data;
}

async function fetchAllEvents(): Promise<ClubEvent[]> {
  const data = await api<{ data: ClubEvent[] }>('GET', '/events');
  return data.data;
}

async function fetchClubEvents(clubId: string): Promise<ClubEvent[]> {
  const data = await api<{ data: ClubEvent[] }>('GET', `/clubs/${clubId}/events`);
  return data.data;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 2F RENDER FUNCTIONS ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function renderProjectSelector(projects: Project[]) {
  const sel = document.getElementById('project-select') as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = '<option value="">— Choose a project —</option>' +
    projects.map(p => `<option value="${p._id}">${p.name} (${p.status})</option>`).join('');
  if (currentProjectId) sel.value = currentProjectId;
}

async function renderUpdatesTab() {
  const container = document.getElementById('updates-list');
  if (!container || !currentProjectId || !currentUserId) return;

  setLoading('updates-list', true);
  try {
    const updates = await fetchUpdates(currentProjectId, currentUserId);
    if (!updates.length) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">📋</div><p>No project updates yet.</p></div>`;
      return;
    }
    container.innerHTML = updates.map(u => renderUpdateCard(u)).join('');
    // Attach delete/edit listeners
    container.querySelectorAll('[data-delete-update]').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteUpdate(btn.getAttribute('data-delete-update')!));
    });
    container.querySelectorAll('[data-edit-update]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-update')!;
        const card = document.querySelector(`[data-update-id="${id}"]`);
        const titleEl = card?.querySelector('.update-title') as HTMLElement;
        const descEl  = card?.querySelector('.update-desc') as HTMLElement;
        openEditModal(id, titleEl?.textContent || '', descEl?.textContent || '');
      });
    });
    // Load update-specific feedback toggle
    container.querySelectorAll('[data-fb-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.getAttribute('data-fb-toggle')!;
        const fbSection = document.getElementById(`fb-${uid}`);
        if (!fbSection) return;
        if (fbSection.style.display === 'none') {
          fbSection.style.display = 'block';
          fbSection.innerHTML = '<div class="spinner"></div>';
          try {
            const fbs = await fetchUpdateFeedback(currentProjectId, uid, currentUserId);
            fbSection.innerHTML = renderFeedbackItems(fbs);
          } catch { fbSection.innerHTML = '<p style="color:var(--danger);font-size:12px">Failed to load feedback.</p>'; }
        } else {
          fbSection.style.display = 'none';
        }
      });
    });
  } catch (e: unknown) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${(e as Error).message}</p></div>`;
  }
}

function renderUpdateCard(u: ProjectUpdate): string {
  const student = typeof u.studentId === 'object' ? u.studentId : { name: '—', email: '' };
  const files = Array.isArray(u.files) && u.files.length
    ? `<div style="margin-top:8px">${(u.files as {name?: string; url?: string}[]).map(f =>
        `<span class="file-tag">📎 ${f.name || f.url || JSON.stringify(f)}</span>`).join('')}</div>`
    : '';
  const isOwnUpdate = typeof u.studentId === 'object'
    ? u.studentId._id === currentUserId
    : u.studentId === currentUserId;
  const editDeleteBtns = (currentRole === 'student' && isOwnUpdate)
    ? `<button class="btn btn-ghost btn-sm" data-edit-update="${u._id}">✏️ Edit</button>
       <button class="btn btn-danger btn-sm" data-delete-update="${u._id}">🗑 Delete</button>`
    : '';

  return `
    <div class="card update-card" data-update-id="${u._id}">
      <div class="card-header">
        <div>
          <div class="card-title update-title">${u.title}</div>
          <div class="card-meta">
            <span>👤 <strong>${student.name}</strong></span>
            <span>🕐 ${formatDate(u.createdAt)}</span>
          </div>
        </div>
      </div>
      <div class="card-body update-desc">${u.description}</div>
      ${files}
      <div class="card-actions">
        ${editDeleteBtns}
        <button class="btn btn-ghost btn-sm" data-fb-toggle="${u._id}">💬 Feedback</button>
      </div>
      <div class="feedback-section" id="fb-${u._id}" style="display:none"></div>
    </div>`;
}

function renderFeedbackItems(fbs: ProjectFeedback[]): string {
  if (!fbs.length) return '<p style="font-size:12px;color:var(--text-faint);margin-top:4px">No feedback on this update yet.</p>';
  return fbs.map(f => `
    <div class="feedback-item">
      <div class="fb-header">
        ${roleBadge(f.mentorId.role)}
        <strong>${f.mentorId.name}</strong>
        <span style="margin-left:auto">${formatDate(f.createdAt)}</span>
      </div>
      <div class="fb-text">${f.feedbackText}</div>
    </div>`).join('');
}

async function renderFeedbackTab() {
  const container = document.getElementById('feedback-list');
  if (!container || !currentProjectId || !currentUserId) return;

  setLoading('feedback-list', true);
  try {
    const feedbackList = await fetchFeedback(currentProjectId, currentUserId);
    if (!feedbackList.length) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">💬</div><p>No mentor feedback yet.</p></div>`;
      return;
    }
    container.innerHTML = feedbackList.map(f => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-meta" style="margin-bottom:4px">
              ${roleBadge(f.mentorId.role)}
              <strong style="color:var(--text)">${f.mentorId.name}</strong>
              <span>${formatDate(f.createdAt)}</span>
            </div>
            ${f.updateId ? `<div style="font-size:12px;color:var(--text-faint)">📌 Re: <em>${f.updateId.title}</em></div>` : '<div style="font-size:12px;color:var(--text-faint)">📌 General project feedback</div>'}
          </div>
          <span class="badge badge-feedback">Feedback</span>
        </div>
        <div class="card-body">${f.feedbackText}</div>
      </div>`).join('');
  } catch (e: unknown) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${(e as Error).message}</p></div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 2F ACTIONS ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function handleCreateUpdate(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const title       = (form.querySelector('#new-title') as HTMLInputElement).value.trim();
  const description = (form.querySelector('#new-desc') as HTMLTextAreaElement).value.trim();
  const fileUrl     = (form.querySelector('#new-file-url') as HTMLInputElement).value.trim();

  if (!title || !description) { toast('Title and description are required', 'error'); return; }

  const files = fileUrl ? [{ name: fileUrl, url: fileUrl }] : [];

  const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  btn.disabled = true;
  try {
    await api('POST', `/projects/${currentProjectId}/updates`, {
      studentId: currentUserId,
      title, description, files,
    });
    toast('Update submitted successfully!');
    form.reset();
    renderUpdatesTab();
  } catch (err: unknown) {
    toast((err as Error).message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleDeleteUpdate(updateId: string) {
  if (!confirm('Delete this update? This will also remove associated feedback.')) return;
  try {
    await api('DELETE', `/projects/${currentProjectId}/updates/${updateId}`, { studentId: currentUserId });
    toast('Update deleted.');
    renderUpdatesTab();
  } catch (err: unknown) {
    toast((err as Error).message, 'error');
  }
}

function openEditModal(updateId: string, title: string, description: string) {
  document.getElementById('edit-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'edit-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;
    display:flex;align-items:center;justify-content:center;padding:20px;`;
  overlay.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);
      padding:24px;width:100%;max-width:500px;box-shadow:var(--shadow)">
      <h3 style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:18px">✏️ Edit Update</h3>
      <div class="form-row">
        <label for="edit-title">Title</label>
        <input type="text" id="edit-title" value="${title.replace(/"/g, '&quot;')}" />
      </div>
      <div class="form-row">
        <label for="edit-desc">Description</label>
        <textarea id="edit-desc" rows="4">${description}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
        <button class="btn btn-ghost" id="edit-cancel">Cancel</button>
        <button class="btn btn-primary" id="edit-save">Save Changes</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#edit-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#edit-save')!.addEventListener('click', async () => {
    const newTitle = (overlay.querySelector('#edit-title') as HTMLInputElement).value.trim();
    const newDesc  = (overlay.querySelector('#edit-desc') as HTMLTextAreaElement).value.trim();
    if (!newTitle || !newDesc) { toast('Title and description cannot be empty', 'error'); return; }
    const saveBtn = overlay.querySelector('#edit-save') as HTMLButtonElement;
    saveBtn.disabled = true;
    try {
      await api('PATCH', `/projects/${currentProjectId}/updates/${updateId}`, {
        studentId: currentUserId,
        title: newTitle, description: newDesc,
      });
      toast('Update saved!');
      overlay.remove();
      renderUpdatesTab();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
      saveBtn.disabled = false;
    }
  });
}

async function handleAddFeedback(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const feedbackText = (form.querySelector('#fb-text') as HTMLTextAreaElement).value.trim();
  const updateId     = (form.querySelector('#fb-update-select') as HTMLSelectElement).value;

  if (!feedbackText) { toast('Feedback text is required', 'error'); return; }

  const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  btn.disabled = true;
  try {
    await api('POST', `/projects/${currentProjectId}/feedback`, {
      mentorId: currentUserId,
      feedbackText,
      updateId: updateId || undefined,
    });
    toast('Feedback submitted!');
    form.reset();
    renderFeedbackTab();
  } catch (err: unknown) {
    toast((err as Error).message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 2G EVENT RENDER FUNCTIONS ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function renderEventCard(ev: ClubEvent, showActions: boolean): string {
  const d = formatEventDate(ev.eventDate);
  const clubName = typeof ev.clubId === 'object' ? ev.clubId.name : 'Unknown Club';
  const past = !isUpcoming(ev.eventDate);
  const statusPill = past
    ? '<span class="past-label">Past</span>'
    : '<span class="upcoming-label">Upcoming</span>';

  const actions = showActions ? `
    <div class="event-actions">
      <button class="btn btn-ghost btn-sm" data-edit-event="${ev._id}">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" data-delete-event="${ev._id}">🗑 Delete</button>
    </div>` : '<div></div>';

  return `
    <div class="event-card ${past ? 'past' : ''}" data-event-id="${ev._id}">
      <div class="event-date-badge">
        <span class="ev-month">${d.month}</span>
        <span class="ev-day">${d.day}</span>
        <span class="ev-year">${d.year}</span>
      </div>
      <div class="event-body">
        <div class="event-title">${ev.title}</div>
        <div class="event-meta">
          <span>🏛 <span class="club-pill">${clubName}</span></span>
          <span>🕐 ${d.time}</span>
          <span>📍 ${ev.location}</span>
          ${statusPill}
        </div>
        <div class="event-desc">${ev.description}</div>
      </div>
      ${actions}
    </div>`;
}

function attachEventCardListeners(container: HTMLElement, events: ClubEvent[]) {
  container.querySelectorAll('[data-edit-event]').forEach(btn => {
    const eventId = btn.getAttribute('data-edit-event')!;
    const ev = events.find(e => e._id === eventId);
    if (ev) btn.addEventListener('click', () => openEventEditModal(ev));
  });
  container.querySelectorAll('[data-delete-event]').forEach(btn => {
    const eventId = btn.getAttribute('data-delete-event')!;
    btn.addEventListener('click', () => handleDeleteEvent(eventId));
  });
}

async function renderUpcomingEventsSection() {
  const container = document.getElementById('events-list');
  if (!container) return;
  setLoading('events-list', true);
  try {
    const events = await fetchUpcomingEvents();
    if (!events.length) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">🗓</div><p>No upcoming events at the moment.</p></div>`;
      return;
    }
    container.innerHTML = events.map(ev => renderEventCard(ev, false)).join('');
  } catch (e: unknown) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${(e as Error).message}</p></div>`;
  }
}

async function renderManageEventsSection() {
  const container = document.getElementById('events-list');
  if (!container) return;
  setLoading('events-list', true);
  try {
    const events = await fetchAllEvents();
    if (!events.length) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">🗓</div><p>No events found.</p></div>`;
      return;
    }
    const canWrite = currentRole === 'club_admin' || currentRole === 'faculty_coordinator';
    container.innerHTML = events.map(ev => renderEventCard(ev, canWrite)).join('');
    if (canWrite) {
      attachEventCardListeners(container, events);
    }
  } catch (e: unknown) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${(e as Error).message}</p></div>`;
  }
}

async function renderClubEventsSection() {
  const container = document.getElementById('events-list');
  if (!container) return;
  if (!currentClubId) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">🏛</div><p>Select a club to view its events.</p></div>`;
    return;
  }
  setLoading('events-list', true);
  try {
    const events = await fetchClubEvents(currentClubId);
    if (!events.length) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">🗓</div><p>No events for this club yet.</p></div>`;
      return;
    }
    const canWrite = currentRole === 'club_admin' || currentRole === 'faculty_coordinator';
    container.innerHTML = events.map(ev => renderEventCard(ev, canWrite)).join('');
    if (canWrite) {
      attachEventCardListeners(container, events);
    }
  } catch (e: unknown) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${(e as Error).message}</p></div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 2G EVENT ACTIONS ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function handleCreateEvent(e: Event) {
  e.preventDefault();
  if (!currentUserId) { toast('Please enter your User ID first', 'error'); return; }
  const form = e.target as HTMLFormElement;
  const title       = (form.querySelector('#ev-title') as HTMLInputElement).value.trim();
  const description = (form.querySelector('#ev-desc') as HTMLTextAreaElement).value.trim();
  const eventDate   = (form.querySelector('#ev-date') as HTMLInputElement).value;
  const location    = (form.querySelector('#ev-location') as HTMLInputElement).value.trim();
  const clubId      = (form.querySelector('#ev-club') as HTMLSelectElement)?.value || currentClubId;

  if (!title || !description || !eventDate || !location || !clubId) {
    toast('All fields are required', 'error'); return;
  }

  const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  btn.disabled = true;
  try {
    await api('POST', '/events', {
      userId: currentUserId,
      title, description, clubId,
      eventDate: new Date(eventDate).toISOString(),
      location,
    });
    toast('Event created successfully!');
    form.reset();
    // Refresh the list
    if (eventsMainSection === 'manage') renderManageEventsSection();
    else if (eventsMainSection === 'club') renderClubEventsSection();
    else renderUpcomingEventsSection();
  } catch (err: unknown) {
    toast((err as Error).message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleDeleteEvent(eventId: string) {
  if (!confirm('Delete this event?')) return;
  try {
    await api('DELETE', `/events/${eventId}`, { userId: currentUserId });
    toast('Event deleted.');
    if (eventsMainSection === 'manage') renderManageEventsSection();
    else if (eventsMainSection === 'club') renderClubEventsSection();
  } catch (err: unknown) {
    toast((err as Error).message, 'error');
  }
}

function openEventEditModal(ev: ClubEvent) {
  document.getElementById('event-edit-modal')?.remove();

  const clubName = typeof ev.clubId === 'object' ? ev.clubId.name : 'Club';
  const clubId   = typeof ev.clubId === 'object' ? ev.clubId._id : ev.clubId;

  const clubSelectHtml = currentRole === 'club_admin'
    ? `<div class="form-row">
        <label for="eev-club">Club</label>
        <select id="eev-club">
          ${allClubs.map(c => `<option value="${c._id}" ${c._id === clubId ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
       </div>`
    : `<div class="form-row"><label>Club</label><input type="text" value="${clubName}" disabled /></div>`;

  const overlay = document.createElement('div');
  overlay.id = 'event-edit-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;
    display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;`;
  overlay.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);
      padding:24px;width:100%;max-width:520px;box-shadow:var(--shadow);margin:auto">
      <h3 style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:18px">✏️ Edit Event</h3>
      <div class="form-row">
        <label for="eev-title">Title *</label>
        <input type="text" id="eev-title" value="${ev.title.replace(/"/g, '&quot;')}" />
      </div>
      <div class="form-row">
        <label for="eev-desc">Description *</label>
        <textarea id="eev-desc" rows="4">${ev.description}</textarea>
      </div>
      <div class="form-row">
        <label for="eev-date">Event Date &amp; Time *</label>
        <input type="datetime-local" id="eev-date" value="${toLocalDatetimeInput(ev.eventDate)}" />
      </div>
      <div class="form-row">
        <label for="eev-location">Location *</label>
        <input type="text" id="eev-location" value="${ev.location.replace(/"/g, '&quot;')}" />
      </div>
      ${clubSelectHtml}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
        <button class="btn btn-ghost" id="eev-cancel">Cancel</button>
        <button class="btn btn-primary" id="eev-save">Save Changes</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#eev-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#eev-save')!.addEventListener('click', async () => {
    const newTitle    = (overlay.querySelector('#eev-title') as HTMLInputElement).value.trim();
    const newDesc     = (overlay.querySelector('#eev-desc') as HTMLTextAreaElement).value.trim();
    const newDate     = (overlay.querySelector('#eev-date') as HTMLInputElement).value;
    const newLocation = (overlay.querySelector('#eev-location') as HTMLInputElement).value.trim();
    const newClubId   = currentRole === 'club_admin'
      ? (overlay.querySelector('#eev-club') as HTMLSelectElement).value
      : clubId;

    if (!newTitle || !newDesc || !newDate || !newLocation) {
      toast('All fields are required', 'error'); return;
    }
    const saveBtn = overlay.querySelector('#eev-save') as HTMLButtonElement;
    saveBtn.disabled = true;
    try {
      await api('PUT', `/events/${ev._id}`, {
        userId: currentUserId,
        title: newTitle, description: newDesc,
        eventDate: new Date(newDate).toISOString(),
        location: newLocation,
        clubId: newClubId,
      });
      toast('Event updated!');
      overlay.remove();
      if (eventsMainSection === 'manage') renderManageEventsSection();
      else if (eventsMainSection === 'club') renderClubEventsSection();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
      saveBtn.disabled = false;
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN RENDER ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function renderApp() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <header>
      <div class="header-brand">
        <div class="dot"></div>
        CNP Department
      </div>
      <span class="header-badge">Tasks 2F &amp; 2G</span>
    </header>

    <main>
      <!-- ─── User Config ─── -->
      <div class="config-bar">
        <div class="form-row">
          <label for="input-user-id">Your User ID</label>
          <input type="text" id="input-user-id" placeholder="Paste your MongoDB User _id" value="${currentUserId}" />
        </div>
        <div class="form-row">
          <label for="input-role">Your Role</label>
          <select id="input-role">
            <option value="student"             ${currentRole === 'student'             ? 'selected' : ''}>Student</option>
            <option value="faculty_coordinator" ${currentRole === 'faculty_coordinator' ? 'selected' : ''}>Faculty Coordinator</option>
            <option value="faculty_mentor"      ${currentRole === 'faculty_mentor'      ? 'selected' : ''}>Faculty Mentor</option>
            <option value="project_admin"       ${currentRole === 'project_admin'       ? 'selected' : ''}>Project Admin</option>
            <option value="club_admin"          ${currentRole === 'club_admin'          ? 'selected' : ''}>Club Admin</option>
          </select>
        </div>
        <button class="btn btn-primary" id="btn-apply" style="flex-shrink:0">Apply Role</button>
      </div>

      <!-- ─── Main Navigation ─── -->
      <nav class="main-nav">
        <button class="main-nav-btn ${mainSection === 'events' ? 'active' : ''}" id="nav-events">🗓 Events (2G)</button>
        <button class="main-nav-btn ${mainSection === 'projects' ? 'active' : ''}" id="nav-projects">📋 Project Updates (2F)</button>
      </nav>

      <!-- ─── Content area ─── -->
      <div id="content-area"></div>
    </main>

    <div id="toast-container"></div>
  `;

  document.getElementById('btn-apply')!.addEventListener('click', onApplyRole);
  document.getElementById('input-role')!.addEventListener('change', (e) => {
    currentRole = (e.target as HTMLSelectElement).value;
  });

  document.getElementById('nav-events')!.addEventListener('click', () => {
    mainSection = 'events';
    document.getElementById('nav-events')!.classList.add('active');
    document.getElementById('nav-projects')!.classList.remove('active');
    renderEventsSection();
  });

  document.getElementById('nav-projects')!.addEventListener('click', () => {
    mainSection = 'projects';
    document.getElementById('nav-projects')!.classList.add('active');
    document.getElementById('nav-events')!.classList.remove('active');
    renderProjectsSection();
  });

  // Load clubs for events
  fetchClubs().then(c => { allClubs = c; }).catch(() => {});

  // Render default section
  if (mainSection === 'events') renderEventsSection();
  else renderProjectsSection();
}

// ──────────────────────────────────────────────────────────────────────────────
// EVENTS SECTION (2G)
// ──────────────────────────────────────────────────────────────────────────────

function renderEventsSection() {
  const area = document.getElementById('content-area')!;
  const canWrite = currentRole === 'club_admin' || currentRole === 'faculty_coordinator';

  // Sub-tabs
  const subTabs = `
    <div class="tab-bar" style="margin-bottom:20px">
      <button class="tab-btn ${eventsMainSection === 'upcoming' ? 'active' : ''}" id="ev-tab-upcoming">🔮 Upcoming Events</button>
      ${canWrite ? `<button class="tab-btn ${eventsMainSection === 'manage' ? 'active' : ''}" id="ev-tab-manage">⚙️ Manage All Events</button>` : ''}
      <button class="tab-btn ${eventsMainSection === 'club' ? 'active' : ''}" id="ev-tab-club">🏛 By Club</button>
    </div>`;

  // Create event form (only for write roles)
  const createForm = canWrite ? `
    <div class="form-panel" id="ev-create-panel">
      <h3><span class="icon">➕</span> Create New Event</h3>
      <form id="form-create-event">
        <div class="form-row">
          <label for="ev-title">Title *</label>
          <input type="text" id="ev-title" placeholder="e.g. Annual Music Night" required />
        </div>
        <div class="form-row">
          <label for="ev-desc">Description *</label>
          <textarea id="ev-desc" placeholder="Describe this event..." rows="3" required></textarea>
        </div>
        <div class="form-row">
          <label for="ev-date">Event Date &amp; Time *</label>
          <input type="datetime-local" id="ev-date" required />
        </div>
        <div class="form-row">
          <label for="ev-location">Location *</label>
          <input type="text" id="ev-location" placeholder="e.g. University Auditorium" required />
        </div>
        ${currentRole === 'club_admin' ? `
        <div class="form-row">
          <label for="ev-club">Club *</label>
          <select id="ev-club">
            <option value="">— Select a club —</option>
            ${allClubs.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
          </select>
        </div>` : `
        <div class="form-row">
          <label for="ev-club">Club *</label>
          <select id="ev-club">
            <option value="">— Select your assigned club —</option>
            ${allClubs.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
          </select>
        </div>`}
        <button type="submit" class="btn btn-primary" id="btn-create-event">🚀 Create Event</button>
      </form>
    </div>` : '';

  // Club filter (for By Club tab)
  const clubFilter = `
    <div class="config-bar" id="club-filter-bar" style="${eventsMainSection !== 'club' ? 'display:none' : 'margin-bottom:16px'}">
      <div class="form-row">
        <label for="ev-club-select">Select Club</label>
        <select id="ev-club-select">
          <option value="">— Choose a club —</option>
          ${allClubs.map(c => `<option value="${c._id}" ${c._id === currentClubId ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" id="btn-load-club-events" style="flex-shrink:0">View Events</button>
    </div>`;

  area.innerHTML = `
    <h2 class="section-title">🗓 Events</h2>
    <p class="section-sub">Manage and view university club events.</p>
    ${subTabs}
    ${createForm}
    ${clubFilter}
    <div class="section-label" id="events-section-label">Upcoming Events</div>
    <div id="events-list"></div>
  `;

  // Sub-tab click handlers
  document.getElementById('ev-tab-upcoming')?.addEventListener('click', () => {
    eventsMainSection = 'upcoming';
    updateEventsSubTabs();
    document.getElementById('club-filter-bar')!.style.display = 'none';
    document.getElementById('events-section-label')!.textContent = 'Upcoming Events';
    renderUpcomingEventsSection();
  });
  document.getElementById('ev-tab-manage')?.addEventListener('click', () => {
    eventsMainSection = 'manage';
    updateEventsSubTabs();
    document.getElementById('club-filter-bar')!.style.display = 'none';
    document.getElementById('events-section-label')!.textContent = 'All Events';
    renderManageEventsSection();
  });
  document.getElementById('ev-tab-club')?.addEventListener('click', () => {
    eventsMainSection = 'club';
    updateEventsSubTabs();
    document.getElementById('club-filter-bar')!.style.display = '';
    document.getElementById('events-section-label')!.textContent = 'Club Events';
    renderClubEventsSection();
  });

  // Club filter button
  document.getElementById('btn-load-club-events')?.addEventListener('click', () => {
    currentClubId = (document.getElementById('ev-club-select') as HTMLSelectElement).value;
    renderClubEventsSection();
  });

  // Create event form
  if (canWrite) {
    document.getElementById('form-create-event')?.addEventListener('submit', handleCreateEvent);
  }

  // Render initial content based on eventsMainSection
  if (eventsMainSection === 'upcoming') renderUpcomingEventsSection();
  else if (eventsMainSection === 'manage') renderManageEventsSection();
  else {
    document.getElementById('club-filter-bar')!.style.display = '';
    renderClubEventsSection();
  }
}

function updateEventsSubTabs() {
  const tabs = ['upcoming', 'manage', 'club'];
  tabs.forEach(t => {
    const el = document.getElementById(`ev-tab-${t}`);
    if (!el) return;
    if (t === eventsMainSection) el.classList.add('active');
    else el.classList.remove('active');
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// PROJECTS SECTION (2F)
// ──────────────────────────────────────────────────────────────────────────────

function renderProjectsSection() {
  const area = document.getElementById('content-area')!;
  area.innerHTML = `
    <h2 class="section-title">📋 Project Updates & Feedback</h2>
    <p class="section-sub">Manage project updates and mentor feedback.</p>
    <!-- ─── Project Config ─── -->
    <div class="config-bar" style="margin-bottom:20px">
      <div class="form-row">
        <label for="project-select">Project</label>
        <select id="project-select">
          <option value="">— loading projects —</option>
        </select>
      </div>
      <button class="btn btn-primary" id="btn-load" style="flex-shrink:0">Load Project</button>
    </div>
    <div id="proj-content-area"></div>
  `;

  document.getElementById('btn-load')!.addEventListener('click', onLoad);
  document.getElementById('project-select')!.addEventListener('change', (e) => {
    currentProjectId = (e.target as HTMLSelectElement).value;
  });

  // Pre-load project list
  fetchProjects().then(p => { allProjects = p; renderProjectSelector(p); }).catch(() => {});
}

async function onApplyRole() {
  currentUserId = (document.getElementById('input-user-id') as HTMLInputElement).value.trim();
  currentRole   = (document.getElementById('input-role') as HTMLSelectElement).value;

  if (!currentUserId) { toast('Please enter your User ID', 'error'); return; }
  toast(`Role applied: ${currentRole}`);

  // Re-render current section with new role
  if (mainSection === 'events') renderEventsSection();
  else renderProjectsSection();
}

async function onLoad() {
  currentUserId    = (document.getElementById('input-user-id') as HTMLInputElement).value.trim();
  currentRole      = (document.getElementById('input-role') as HTMLSelectElement).value;
  currentProjectId = (document.getElementById('project-select') as HTMLSelectElement).value;

  if (!currentUserId) { toast('Please enter your User ID', 'error'); return; }

  try {
    if (currentRole === 'student') {
      const projs = await fetchStudentProjects(currentUserId);
      allProjects = projs;
    } else if (currentRole === 'faculty_mentor') {
      const projs = await fetchMentorProjects(currentUserId);
      allProjects = projs;
    } else {
      allProjects = await fetchProjects();
    }
    renderProjectSelector(allProjects);
    if (allProjects.length && !currentProjectId) {
      currentProjectId = allProjects[0]._id;
      const sel = document.getElementById('project-select') as HTMLSelectElement;
      sel.value = currentProjectId;
    }
  } catch (e: unknown) {
    toast(`Failed to load projects: ${(e as Error).message}`, 'error');
    return;
  }

  if (!currentProjectId) { toast('Please select a project', 'error'); return; }

  renderProjContentArea();
}

function renderProjContentArea() {
  const area = document.getElementById('proj-content-area')!;
  area.innerHTML = `
    <div class="tab-bar">
      <button class="tab-btn ${activeTab === 'updates'  ? 'active' : ''}" id="tab-updates">📋 Project Updates</button>
      <button class="tab-btn ${activeTab === 'feedback' ? 'active' : ''}" id="tab-feedback">💬 Mentor Feedback</button>
    </div>
    <div id="tab-content"></div>
  `;

  document.getElementById('tab-updates')!.addEventListener('click', () => {
    activeTab = 'updates';
    renderTabContent();
    document.getElementById('tab-updates')!.classList.add('active');
    document.getElementById('tab-feedback')!.classList.remove('active');
  });
  document.getElementById('tab-feedback')!.addEventListener('click', () => {
    activeTab = 'feedback';
    renderTabContent();
    document.getElementById('tab-updates')!.classList.remove('active');
    document.getElementById('tab-feedback')!.classList.add('active');
  });

  renderTabContent();
}

async function renderTabContent() {
  const tab = document.getElementById('tab-content')!;

  if (activeTab === 'updates') {
    let updatesForSelect: ProjectUpdate[] = [];
    try {
      updatesForSelect = await fetchUpdates(currentProjectId, currentUserId);
    } catch { /* ignore */ }

    const createForm = currentRole === 'student' ? `
      <div class="form-panel">
        <h3><span class="icon">📝</span> Submit a Project Update</h3>
        <form id="form-create-update">
          <div class="form-row">
            <label for="new-title">Title *</label>
            <input type="text" id="new-title" placeholder="e.g. Sprint 1 completed" required />
          </div>
          <div class="form-row">
            <label for="new-desc">Description *</label>
            <textarea id="new-desc" placeholder="Describe what was done this update..." required></textarea>
          </div>
          <div class="form-row">
            <label for="new-file-url">File URL (optional)</label>
            <input type="url" id="new-file-url" placeholder="https://drive.google.com/..." />
          </div>
          <button type="submit" class="btn btn-primary">🚀 Submit Update</button>
        </form>
      </div>
    ` : '';

    const mentorFeedbackOnUpdate = (currentRole === 'faculty_mentor' || currentRole === 'project_admin') && updatesForSelect.length ? `
      <div class="form-panel">
        <h3><span class="icon">💬</span> Add Feedback on an Update</h3>
        <form id="form-fb-on-update">
          <div class="form-row">
            <label for="fbu-update-select">Select Update</label>
            <select id="fbu-update-select">
              ${updatesForSelect.map(u => `<option value="${u._id}">${u.title}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label for="fbu-text">Feedback *</label>
            <textarea id="fbu-text" placeholder="Your feedback on this update..." required></textarea>
          </div>
          <button type="submit" class="btn btn-teal">💬 Submit Feedback</button>
        </form>
      </div>
    ` : '';

    tab.innerHTML = `
      ${createForm}
      ${mentorFeedbackOnUpdate}
      <div class="section-label">All Updates</div>
      <div id="updates-list"></div>
    `;

    if (currentRole === 'student') {
      document.getElementById('form-create-update')?.addEventListener('submit', handleCreateUpdate);
    }
    if (mentorFeedbackOnUpdate) {
      document.getElementById('form-fb-on-update')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const feedbackText = (form.querySelector('#fbu-text') as HTMLTextAreaElement).value.trim();
        const updateId     = (form.querySelector('#fbu-update-select') as HTMLSelectElement).value;
        if (!feedbackText) { toast('Feedback text is required', 'error'); return; }
        const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        btn.disabled = true;
        try {
          await api('POST', `/projects/${currentProjectId}/feedback`, {
            mentorId: currentUserId, feedbackText, updateId: updateId || undefined,
          });
          toast('Feedback submitted!');
          form.reset();
        } catch (err: unknown) { toast((err as Error).message, 'error'); }
        finally { btn.disabled = false; }
      });
    }

    renderUpdatesTab();

  } else {
    const addFeedbackForm = (currentRole === 'faculty_mentor' || currentRole === 'project_admin') ? `
      <div class="form-panel">
        <h3><span class="icon">✍️</span> Add General Project Feedback</h3>
        <form id="form-add-feedback">
          <div class="form-row">
            <label for="fb-update-select">Related Update (optional)</label>
            <select id="fb-update-select">
              <option value="">— General project feedback —</option>
            </select>
          </div>
          <div class="form-row">
            <label for="fb-text">Feedback Text *</label>
            <textarea id="fb-text" placeholder="Write your feedback here..." required></textarea>
          </div>
          <button type="submit" class="btn btn-teal">💬 Submit Feedback</button>
        </form>
      </div>
    ` : '';

    tab.innerHTML = `
      ${addFeedbackForm}
      <div class="section-label">All Feedback</div>
      <div id="feedback-list"></div>
    `;

    if (addFeedbackForm) {
      const sel = document.getElementById('fb-update-select') as HTMLSelectElement;
      try {
        const updates = await fetchUpdates(currentProjectId, currentUserId);
        sel.innerHTML = '<option value="">— General project feedback —</option>' +
          updates.map(u => `<option value="${u._id}">${u.title}</option>`).join('');
      } catch { /* ignore */ }
      document.getElementById('form-add-feedback')?.addEventListener('submit', handleAddFeedback);
    }

    renderFeedbackTab();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════════

renderApp();
