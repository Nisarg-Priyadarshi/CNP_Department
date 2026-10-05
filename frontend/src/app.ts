/**
 * Task 2F — Project Updates & Mentor Feedback Frontend
 * Task 2G — Club Events Management Frontend
 * Task 2H — Project Materials, Inventory & Material Requests Frontend
 * Task 2I — Notifications System Frontend
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
 *
 * Roles supported for 2H:
 *   - student (team_leader) → add materials, send requests, view team/materials/requests
 *   - student (member)      → view team, materials, requests (read-only)
 *   - faculty_mentor        → view assigned project team, materials, requests (read-only)
 *   - project_admin         → full inventory management, approve/reject requests, assign leader
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

// ── Task 2H types ─────────────────────────────────────────────────────────────
interface GuitarInventoryItem {
  _id: string;
  name: string;
  description: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  location: string;
  createdBy: { _id: string; name: string; role: string } | string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectMaterial {
  _id: string;
  projectId: string | { _id: string; name: string };
  name: string;
  quantity: number;
  source: 'self_purchased' | 'owned' | 'guitar';
  inventoryItemId: null | { _id: string; name: string; category: string };
  materialRequestId: null | string;
  addedBy: { _id: string; name: string; role: string } | string;
  createdAt: string;
}

interface MaterialRequest {
  _id: string;
  projectId: { _id: string; name: string } | string;
  requestedBy: { _id: string; name: string; role: string } | string;
  inventoryItemId: { _id: string; name: string; category: string; availableQuantity: number } | string;
  quantity: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  reviewedBy: { _id: string; name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface TeamMember {
  membershipId: string;
  student: { _id: string; name: string; email: string; role: string };
  position: 'Team Leader' | 'Team Member';
  joinedAt: string;
}

interface InventoryAllocation {
  _id: string;
  inventoryItemId: { _id: string; name: string; category: string; totalQuantity: number; availableQuantity: number } | string;
  projectId: { _id: string; name: string } | string;
  quantity: number;
  allocatedBy: { _id: string; name: string } | string;
  allocatedAt: string;
}

// ── Task 2I: Notification type ────────────────────────────────────────────────
interface AppNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
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
let mainSection              = 'projects'; // 'projects' | 'events' | 'materials'

// 2H state
let allInventoryItems: GuitarInventoryItem[] = [];
let h2MaterialsSubTab = 'team'; // 'team' | 'materials' | 'requests' | 'inventory' | 'allRequests' | 'allocations'

// 2I state
let notifPanelOpen     = false;
let notifUnreadCount   = 0;
let notifList: AppNotification[] = [];
let notifPollInterval: number | undefined;

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
      <div style="display:flex;align-items:center;gap:12px">
        <span class="header-badge">Tasks 2F–2I</span>
        <button class="notif-bell" id="notif-bell" title="Notifications">
          🔔
          <span class="notif-badge" id="notif-badge" style="display:none">0</span>
        </button>
      </div>
    </header>

    <!-- Notification Panel -->
    <div class="notif-panel" id="notif-panel" style="display:none">
      <div class="notif-panel-header">
        <span>🔔 Notifications</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" id="notif-mark-all">Mark all read</button>
          <button class="btn btn-ghost btn-sm" id="notif-close">✕</button>
        </div>
      </div>
      <div class="notif-list" id="notif-list">
        <div class="empty-state"><p>Loading…</p></div>
      </div>
    </div>

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
        <button class="main-nav-btn ${mainSection === 'materials' ? 'active' : ''}" id="nav-materials">🔧 Materials &amp; Inventory (2H)</button>
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
    document.getElementById('nav-materials')!.classList.remove('active');
    renderEventsSection();
  });

  document.getElementById('nav-projects')!.addEventListener('click', () => {
    mainSection = 'projects';
    document.getElementById('nav-projects')!.classList.add('active');
    document.getElementById('nav-events')!.classList.remove('active');
    document.getElementById('nav-materials')!.classList.remove('active');
    renderProjectsSection();
  });

  document.getElementById('nav-materials')!.addEventListener('click', () => {
    mainSection = 'materials';
    document.getElementById('nav-materials')!.classList.add('active');
    document.getElementById('nav-events')!.classList.remove('active');
    document.getElementById('nav-projects')!.classList.remove('active');
    renderMaterialsSection();
  });

  // ── 2I: Notification bell ─────────────────────────────────────────────────
  document.getElementById('notif-bell')!.addEventListener('click', () => {
    notifPanelOpen = !notifPanelOpen;
    const panel = document.getElementById('notif-panel')!;
    panel.style.display = notifPanelOpen ? 'flex' : 'none';
    if (notifPanelOpen && currentUserId) loadNotifications();
  });
  document.getElementById('notif-close')!.addEventListener('click', () => {
    notifPanelOpen = false;
    document.getElementById('notif-panel')!.style.display = 'none';
  });
  document.getElementById('notif-mark-all')!.addEventListener('click', async () => {
    if (!currentUserId) return;
    try {
      await api('PATCH', '/notifications/read-all', { userId: currentUserId });
      await loadNotifications();
    } catch (e: unknown) { toast((e as Error).message, 'error'); }
  });

  // Load clubs for events
  fetchClubs().then(c => { allClubs = c; }).catch(() => {});
  // Load inventory for 2H
  fetchInventory().then(items => { allInventoryItems = items; }).catch(() => {});

  // Render default section
  if (mainSection === 'events') renderEventsSection();
  else if (mainSection === 'materials') renderMaterialsSection();
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

// ══════════════════════════════════════════════════════════════════════════════
// ── TASK 2H: FETCH HELPERS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function fetchInventory(): Promise<GuitarInventoryItem[]> {
  const data = await api<{ data: GuitarInventoryItem[] }>('GET', '/inventory');
  return data.data;
}

async function fetchProjectTeam(projectId: string): Promise<{ data: TeamMember[]; project: { id: string; name: string; teamLeader: unknown } }> {
  return api('GET', `/projects/${projectId}/team`);
}

async function fetchProjectMaterials(projectId: string, userId: string): Promise<{ data: ProjectMaterial[] }> {
  return api('GET', `/projects/${projectId}/materials?userId=${userId}`);
}

async function fetchProjectRequests(projectId: string, userId: string): Promise<{ data: MaterialRequest[] }> {
  return api('GET', `/material-requests/project/${projectId}?userId=${userId}`);
}

async function fetchAllRequests(adminId: string): Promise<{ data: MaterialRequest[] }> {
  return api('GET', `/material-requests?adminId=${adminId}`);
}

async function fetchAllAllocations(adminId: string): Promise<{ data: InventoryAllocation[] }> {
  return api('GET', `/allocations?adminId=${adminId}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TASK 2H: MAIN SECTION ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function renderMaterialsSection() {
  const area = document.getElementById('content-area')!;
  const isAdmin = currentRole === 'project_admin';
  const isStudent = currentRole === 'student';
  const isMentor = currentRole === 'faculty_mentor';

  // Determine available tabs based on role
  const tabs: { id: string; label: string }[] = [];
  if (isStudent || isMentor || isAdmin) {
    if (!isAdmin) {
      tabs.push({ id: 'team',     label: '👥 Project Team' });
      tabs.push({ id: 'materials', label: '📦 Materials' });
      tabs.push({ id: 'requests', label: '📋 Requests' });
    }
  }
  if (isAdmin) {
    tabs.push({ id: 'team',        label: '👥 Project Team' });
    tabs.push({ id: 'materials',   label: '📦 Project Materials' });
    tabs.push({ id: 'requests',    label: '📋 Project Requests' });
    tabs.push({ id: 'inventory',   label: '🏭 Inventory' });
    tabs.push({ id: 'allRequests', label: '📨 All Requests' });
    tabs.push({ id: 'allocations', label: '📊 Allocations' });
  }

  // Ensure h2MaterialsSubTab is valid for this role
  if (!tabs.find(t => t.id === h2MaterialsSubTab)) {
    h2MaterialsSubTab = tabs[0]?.id || 'team';
  }

  const projectScopedTabs = ['team', 'materials', 'requests'];
  const needsProject = projectScopedTabs.includes(h2MaterialsSubTab);

  area.innerHTML = `
    <h2 class="section-title">🔧 Materials & Inventory</h2>
    <p class="section-sub">Project materials, Guitar inventory, and material requests.</p>

    <!-- Tab bar -->
    <div class="tab-bar" style="margin-bottom:20px">
      ${tabs.map(t => `<button class="tab-btn ${h2MaterialsSubTab === t.id ? 'active' : ''}" id="h2-tab-${t.id}">${t.label}</button>`).join('')}
    </div>

    <!-- Project selector (for project-scoped tabs) -->
    ${needsProject ? `
    <div class="config-bar" style="margin-bottom:20px" id="h2-project-bar">
      <div class="form-row">
        <label for="h2-project-select">Project</label>
        <select id="h2-project-select">
          <option value="">— loading projects —</option>
        </select>
      </div>
      <button class="btn btn-primary" id="h2-btn-load" style="flex-shrink:0">Load</button>
    </div>` : ''}

    <div id="h2-content"></div>
  `;

  // Attach tab listeners
  tabs.forEach(t => {
    document.getElementById(`h2-tab-${t.id}`)?.addEventListener('click', () => {
      h2MaterialsSubTab = t.id;
      renderMaterialsSection();
    });
  });

  // Load project selector
  if (needsProject) {
    _loadH2ProjectSelector();
    document.getElementById('h2-btn-load')?.addEventListener('click', _onH2Load);
  }

  // For non-project tabs, render immediately
  if (!needsProject) {
    _renderH2SubTab();
  }
}

async function _loadH2ProjectSelector() {
  const sel = document.getElementById('h2-project-select') as HTMLSelectElement | null;
  if (!sel) return;
  try {
    let projects: Project[] = [];
    if (currentRole === 'student') {
      const data = await api<{ data: { project: Project }[] }>('GET', `/users/${currentUserId}/projects`);
      projects = data.data.map(d => d.project);
    } else if (currentRole === 'faculty_mentor') {
      const data = await api<{ data: { project: Project }[] }>('GET', `/mentors/${currentUserId}/projects`);
      projects = data.data.map(d => d.project);
    } else {
      const data = await api<{ data: Project[] }>('GET', '/projects');
      projects = data.data;
    }
    allProjects = projects;
    sel.innerHTML = '<option value="">— Choose a project —</option>' +
      projects.map(p => `<option value="${p._id}" ${p._id === currentProjectId ? 'selected' : ''}>${p.name}</option>`).join('');
    if (currentProjectId) {
      sel.value = currentProjectId;
      _renderH2SubTab();
    }
  } catch (e: unknown) {
    sel.innerHTML = '<option value="">Failed to load projects</option>';
  }
}

async function _onH2Load() {
  const sel = document.getElementById('h2-project-select') as HTMLSelectElement | null;
  if (!sel) return;
  currentProjectId = sel.value;
  if (!currentProjectId) { toast('Please select a project', 'error'); return; }
  if (!currentUserId) { toast('Please enter your User ID first', 'error'); return; }
  _renderH2SubTab();
}

async function _renderH2SubTab() {
  const container = document.getElementById('h2-content');
  if (!container) return;

  if (!currentUserId && h2MaterialsSubTab !== 'inventory') {
    container.innerHTML = '<div class="empty-state"><div class="emoji">👤</div><p>Please enter your User ID and click Apply Role first.</p></div>';
    return;
  }

  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    switch (h2MaterialsSubTab) {
      case 'team':       await renderH2Team(container); break;
      case 'materials':  await renderH2Materials(container); break;
      case 'requests':   await renderH2Requests(container); break;
      case 'inventory':  await renderH2Inventory(container); break;
      case 'allRequests': await renderH2AllRequests(container); break;
      case 'allocations': await renderH2Allocations(container); break;
    }
  } catch (e: unknown) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${(e as Error).message}</p></div>`;
  }
}

// ── TEAM TAB ──────────────────────────────────────────────────────────────────

async function renderH2Team(container: HTMLElement) {
  if (!currentProjectId) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">👥</div><p>Select a project to view its team.</p></div>';
    return;
  }

  const result = await fetchProjectTeam(currentProjectId);
  const team: TeamMember[] = result.data;
  const project = result.project;
  const isAdmin = currentRole === 'project_admin';

  let adminControls = '';
  if (isAdmin) {
    const members = team.map(m => m.student);
    adminControls = `
      <div class="form-panel" style="margin-bottom:20px">
        <h3><span class="icon">👑</span> Assign / Change Team Leader</h3>
        <div class="form-row">
          <label for="h2-leader-select">Select Team Leader</label>
          <select id="h2-leader-select">
            <option value="">— Select a member —</option>
            ${members.map(m => `<option value="${m._id}" ${project.teamLeader && typeof project.teamLeader === 'object' && (project.teamLeader as { _id: string })._id === m._id ? 'selected' : ''}>${m.name} (${m.email})</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" id="h2-btn-assign-leader">👑 Assign as Team Leader</button>
      </div>`;
  }

  container.innerHTML = `
    ${adminControls}
    <div class="section-label">Project Team — ${team.length} Member${team.length !== 1 ? 's' : ''}</div>
    <div class="team-table-wrap">
      <table class="team-table">
        <thead>
          <tr><th>Student Name</th><th>Email</th><th>Position</th><th>Joined</th></tr>
        </thead>
        <tbody>
          ${team.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-faint);padding:20px">No members yet.</td></tr>' :
            team.map(m => `
              <tr>
                <td><strong>${m.student.name}</strong></td>
                <td style="color:var(--text-faint);font-size:12px">${m.student.email}</td>
                <td>${m.position === 'Team Leader'
                  ? '<span class="badge badge-leader">👑 Team Leader</span>'
                  : '<span class="badge badge-member">Team Member</span>'}</td>
                <td style="font-size:12px;color:var(--text-faint)">${formatDate(m.joinedAt)}</td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  if (isAdmin) {
    document.getElementById('h2-btn-assign-leader')?.addEventListener('click', async () => {
      const studentId = (document.getElementById('h2-leader-select') as HTMLSelectElement).value;
      if (!studentId) { toast('Select a member first', 'error'); return; }
      const btn = document.getElementById('h2-btn-assign-leader') as HTMLButtonElement;
      btn.disabled = true;
      try {
        await api('PATCH', `/projects/${currentProjectId}/team-leader`, {
          adminId: currentUserId,
          studentId,
        });
        toast('Team Leader assigned successfully!');
        renderH2Team(container);
      } catch (e: unknown) {
        toast((e as Error).message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}

// ── MATERIALS TAB ─────────────────────────────────────────────────────────────

async function renderH2Materials(container: HTMLElement) {
  if (!currentProjectId) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">📦</div><p>Select a project to view its materials.</p></div>';
    return;
  }

  const result = await fetchProjectMaterials(currentProjectId, currentUserId);
  const materials: ProjectMaterial[] = result.data;

  // Check if current user is Team Leader of this project
  let isTeamLeader = false;
  if (currentRole === 'student') {
    try {
      const teamResult = await fetchProjectTeam(currentProjectId);
      const me = teamResult.data.find(m => m.student._id === currentUserId);
      isTeamLeader = me?.position === 'Team Leader';
    } catch { /* ignore */ }
  }

  const sourceLabel = (s: string) => {
    if (s === 'self_purchased') return '<span class="badge badge-self">Self Purchased</span>';
    if (s === 'owned') return '<span class="badge badge-owned">Owned</span>';
    if (s === 'guitar') return '<span class="badge badge-guitar">✅ Guitar (Approved)</span>';
    return s;
  };

  const addForm = isTeamLeader ? `
    <div class="form-panel" style="margin-bottom:20px">
      <h3><span class="icon">➕</span> Add Material</h3>
      <form id="h2-form-add-material">
        <div class="form-row">
          <label for="h2-mat-name">Material Name *</label>
          <input type="text" id="h2-mat-name" placeholder="e.g. Wire_1" required />
        </div>
        <div class="form-row">
          <label for="h2-mat-qty">Quantity *</label>
          <input type="number" id="h2-mat-qty" min="1" placeholder="e.g. 10" required />
        </div>
        <div class="form-row">
          <label for="h2-mat-source">Source *</label>
          <select id="h2-mat-source">
            <option value="self_purchased">Self Purchased</option>
            <option value="owned">Already Owned</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">➕ Add Material</button>
      </form>
    </div>` : '';

  container.innerHTML = `
    ${addForm}
    <div class="section-label">Project Materials — ${materials.length} entr${materials.length !== 1 ? 'ies' : 'y'}</div>
    ${materials.length === 0 ? '<div class="empty-state"><div class="emoji">📦</div><p>No materials recorded yet.</p></div>' : `
    <table class="team-table">
      <thead>
        <tr><th>Material Name</th><th>Quantity</th><th>Source</th><th>Added By</th><th>Date</th></tr>
      </thead>
      <tbody>
        ${materials.map(m => `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td><span class="qty-badge">${m.quantity}</span></td>
            <td>${sourceLabel(m.source)}</td>
            <td style="font-size:12px;color:var(--text-faint)">${typeof m.addedBy === 'object' ? m.addedBy.name : '—'}</td>
            <td style="font-size:12px;color:var(--text-faint)">${formatDate(m.createdAt)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`}
  `;

  if (isTeamLeader) {
    document.getElementById('h2-form-add-material')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name   = (document.getElementById('h2-mat-name') as HTMLInputElement).value.trim();
      const qty    = Number((document.getElementById('h2-mat-qty') as HTMLInputElement).value);
      const source = (document.getElementById('h2-mat-source') as HTMLSelectElement).value;
      if (!name || !qty) { toast('Name and quantity are required', 'error'); return; }
      const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
      btn.disabled = true;
      try {
        await api('POST', `/projects/${currentProjectId}/materials`, {
          leaderId: currentUserId,
          name, quantity: qty, source,
        });
        toast('Material added!');
        (e.target as HTMLFormElement).reset();
        renderH2Materials(container);
      } catch (err: unknown) {
        toast((err as Error).message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}

// ── REQUESTS TAB (project-scoped) ─────────────────────────────────────────────

async function renderH2Requests(container: HTMLElement) {
  if (!currentProjectId) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">📋</div><p>Select a project to view its requests.</p></div>';
    return;
  }

  const result = await fetchProjectRequests(currentProjectId, currentUserId);
  const requests: MaterialRequest[] = result.data;

  // Check if current user is Team Leader
  let isTeamLeader = false;
  if (currentRole === 'student') {
    try {
      const teamResult = await fetchProjectTeam(currentProjectId);
      const me = teamResult.data.find(m => m.student._id === currentUserId);
      isTeamLeader = me?.position === 'Team Leader';
    } catch { /* ignore */ }
  }

  const statusBadge = (s: string) => {
    if (s === 'pending')  return '<span class="badge badge-pending">⏳ Pending</span>';
    if (s === 'approved') return '<span class="badge badge-approved">✅ Approved</span>';
    if (s === 'rejected') return '<span class="badge badge-rejected">❌ Rejected</span>';
    return s;
  };

  const requestForm = isTeamLeader ? `
    <div class="form-panel" style="margin-bottom:20px">
      <h3><span class="icon">📨</span> Request Material from Guitar</h3>
      <form id="h2-form-request-material">
        <div class="form-row">
          <label for="h2-req-item">Select Inventory Item *</label>
          <select id="h2-req-item">
            <option value="">— Choose an item —</option>
            ${allInventoryItems.map(i => `<option value="${i._id}">${i.name} (Available: ${i.availableQuantity})</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label for="h2-req-qty">Quantity *</label>
          <input type="number" id="h2-req-qty" min="1" placeholder="e.g. 1" required />
        </div>
        <div class="form-row">
          <label for="h2-req-reason">Reason (optional)</label>
          <textarea id="h2-req-reason" rows="2" placeholder="Why do you need this material?"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">📨 Send Request</button>
      </form>
    </div>` : '';

  container.innerHTML = `
    ${requestForm}
    <div class="section-label">Material Requests — ${requests.length} total</div>
    ${requests.length === 0 ? '<div class="empty-state"><div class="emoji">📋</div><p>No material requests yet.</p></div>' : `
    <div class="requests-list">
      ${requests.map(r => {
        const invItem = typeof r.inventoryItemId === 'object' ? r.inventoryItemId : null;
        const proj = typeof r.projectId === 'object' ? r.projectId : null;
        return `
          <div class="card request-card request-${r.status}">
            <div class="card-header">
              <div>
                <div class="card-title">${invItem ? invItem.name : '—'}</div>
                <div class="card-meta">
                  <span>📦 Qty: <strong>${r.quantity}</strong></span>
                  ${proj ? `<span>📂 ${proj.name}</span>` : ''}
                  <span>📅 ${formatDate(r.createdAt)}</span>
                </div>
              </div>
              ${statusBadge(r.status)}
            </div>
            ${r.reason ? `<div class="card-body" style="margin-top:6px;font-size:12.5px;color:var(--text-faint)">💬 ${r.reason}</div>` : ''}
            ${r.status === 'rejected' && r.rejectionReason ? `
              <div style="margin-top:8px;padding:10px;background:var(--danger-soft);border-radius:8px;font-size:13px;color:var(--danger)">
                ❌ Rejection reason: ${r.rejectionReason}
              </div>` : ''}
            ${r.status === 'approved' ? `
              <div style="margin-top:8px;padding:10px;background:var(--success-soft);border-radius:8px;font-size:13px;color:var(--success)">
                ✅ Approved on ${r.reviewedAt ? formatDate(r.reviewedAt) : '—'}
              </div>` : ''}
          </div>`;
      }).join('')}
    </div>`}
  `;

  if (isTeamLeader) {
    document.getElementById('h2-form-request-material')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inventoryItemId = (document.getElementById('h2-req-item') as HTMLSelectElement).value;
      const quantity = Number((document.getElementById('h2-req-qty') as HTMLInputElement).value);
      const reason   = (document.getElementById('h2-req-reason') as HTMLTextAreaElement).value.trim();
      if (!inventoryItemId) { toast('Select an inventory item', 'error'); return; }
      if (!quantity || quantity < 1) { toast('Enter a valid quantity', 'error'); return; }
      const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
      btn.disabled = true;
      try {
        await api('POST', '/material-requests', {
          requestedBy: currentUserId,
          projectId: currentProjectId,
          inventoryItemId,
          quantity,
          reason,
        });
        toast('Material request sent!');
        (e.target as HTMLFormElement).reset();
        renderH2Requests(container);
      } catch (err: unknown) {
        toast((err as Error).message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}

// ── INVENTORY TAB (admin only) ────────────────────────────────────────────────

async function renderH2Inventory(container: HTMLElement) {
  if (currentRole !== 'project_admin') {
    container.innerHTML = '<div class="empty-state"><div class="emoji">🔒</div><p>Inventory management is restricted to Project Admin.</p></div>';
    return;
  }

  const items = await fetchInventory();
  allInventoryItems = items;

  container.innerHTML = `
    <div class="form-panel" style="margin-bottom:20px">
      <h3><span class="icon">➕</span> Add Inventory Item</h3>
      <form id="h2-form-add-inv">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row">
            <label for="h2-inv-name">Name *</label>
            <input type="text" id="h2-inv-name" placeholder="e.g. Arduino Uno" required />
          </div>
          <div class="form-row">
            <label for="h2-inv-category">Category</label>
            <input type="text" id="h2-inv-category" placeholder="e.g. Microcontroller" />
          </div>
          <div class="form-row">
            <label for="h2-inv-total">Total Qty *</label>
            <input type="number" id="h2-inv-total" min="0" placeholder="10" required />
          </div>
          <div class="form-row">
            <label for="h2-inv-avail">Available Qty</label>
            <input type="number" id="h2-inv-avail" min="0" placeholder="Same as total" />
          </div>
          <div class="form-row">
            <label for="h2-inv-location">Location</label>
            <input type="text" id="h2-inv-location" placeholder="e.g. Lab Room 3" />
          </div>
          <div class="form-row">
            <label for="h2-inv-desc">Description</label>
            <input type="text" id="h2-inv-desc" placeholder="Short description" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:8px">➕ Add Item</button>
      </form>
    </div>

    <div class="section-label">Guitar Inventory — ${items.length} item${items.length !== 1 ? 's' : ''}</div>
    ${items.length === 0 ? '<div class="empty-state"><div class="emoji">🏭</div><p>No inventory items yet.</p></div>' : `
    <div id="inv-items-list">
      ${items.map(item => renderInventoryCard(item)).join('')}
    </div>`}
  `;

  // Add item form
  document.getElementById('h2-form-add-inv')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = (document.getElementById('h2-inv-name') as HTMLInputElement).value.trim();
    const category = (document.getElementById('h2-inv-category') as HTMLInputElement).value.trim();
    const total    = Number((document.getElementById('h2-inv-total') as HTMLInputElement).value);
    const availEl  = (document.getElementById('h2-inv-avail') as HTMLInputElement).value;
    const avail    = availEl ? Number(availEl) : total;
    const location = (document.getElementById('h2-inv-location') as HTMLInputElement).value.trim();
    const desc     = (document.getElementById('h2-inv-desc') as HTMLInputElement).value.trim();
    if (!name || isNaN(total)) { toast('Name and total quantity are required', 'error'); return; }
    const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await api('POST', '/inventory', {
        adminId: currentUserId,
        name, category, totalQuantity: total,
        availableQuantity: avail, location, description: desc,
      });
      toast('Inventory item added!');
      (e.target as HTMLFormElement).reset();
      renderH2Inventory(container);
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Attach listeners for each item card
  document.querySelectorAll('[data-inv-increase]').forEach(btn => {
    btn.addEventListener('click', () => handleInventoryQty(btn.getAttribute('data-inv-increase')!, 'increase', container));
  });
  document.querySelectorAll('[data-inv-decrease]').forEach(btn => {
    btn.addEventListener('click', () => handleInventoryQty(btn.getAttribute('data-inv-decrease')!, 'decrease', container));
  });
  document.querySelectorAll('[data-inv-delete]').forEach(btn => {
    btn.addEventListener('click', () => handleInventoryDelete(btn.getAttribute('data-inv-delete')!, container));
  });
}

function renderInventoryCard(item: GuitarInventoryItem): string {
  const allocated = item.totalQuantity - item.availableQuantity;
  return `
    <div class="card inv-card" data-item-id="${item._id}">
      <div class="card-header">
        <div>
          <div class="card-title">${item.name}</div>
          <div class="card-meta">
            ${item.category ? `<span>🏷 ${item.category}</span>` : ''}
            ${item.location ? `<span>📍 ${item.location}</span>` : ''}
            <span>📅 ${formatDate(item.createdAt)}</span>
          </div>
          ${item.description ? `<div style="font-size:12.5px;color:var(--text-faint);margin-top:4px">${item.description}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="inv-qty-block">
            <div class="inv-qty-row"><span class="qty-label">Total</span><span class="qty-val">${item.totalQuantity}</span></div>
            <div class="inv-qty-row"><span class="qty-label">Available</span><span class="qty-val avail">${item.availableQuantity}</span></div>
            <div class="inv-qty-row"><span class="qty-label">Allocated</span><span class="qty-val alloc">${allocated}</span></div>
          </div>
        </div>
      </div>
      <div class="card-actions" style="flex-wrap:wrap;gap:6px">
        <button class="btn btn-ghost btn-sm" data-inv-increase="${item._id}">📈 Increase</button>
        <button class="btn btn-ghost btn-sm" data-inv-decrease="${item._id}">📉 Decrease</button>
        <button class="btn btn-danger btn-sm" data-inv-delete="${item._id}">🗑 Delete</button>
      </div>
    </div>`;
}

async function handleInventoryQty(itemId: string, action: 'increase' | 'decrease', container: HTMLElement) {
  const amountStr = prompt(`Enter amount to ${action}:`);
  if (amountStr === null) return;
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) { toast('Enter a valid positive number', 'error'); return; }
  try {
    await api('PATCH', `/inventory/${itemId}/quantity`, {
      adminId: currentUserId, action, amount,
    });
    toast(`Quantity ${action}d by ${amount}`);
    allInventoryItems = await fetchInventory();
    renderH2Inventory(container);
  } catch (e: unknown) {
    toast((e as Error).message, 'error');
  }
}

async function handleInventoryDelete(itemId: string, container: HTMLElement) {
  const item = allInventoryItems.find(i => i._id === itemId);
  if (!confirm(`Delete "${item?.name || 'this item'}" from inventory? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/inventory/${itemId}`, { adminId: currentUserId });
    toast('Item deleted.');
    allInventoryItems = await fetchInventory();
    renderH2Inventory(container);
  } catch (e: unknown) {
    toast((e as Error).message, 'error');
  }
}

// ── ALL REQUESTS TAB (admin) ──────────────────────────────────────────────────

async function renderH2AllRequests(container: HTMLElement) {
  if (currentRole !== 'project_admin') {
    container.innerHTML = '<div class="empty-state"><div class="emoji">🔒</div><p>Access restricted to Project Admin.</p></div>';
    return;
  }

  if (!currentUserId) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">👤</div><p>Please enter your User ID first.</p></div>';
    return;
  }

  const result = await fetchAllRequests(currentUserId);
  const requests: MaterialRequest[] = result.data;

  const statusBadge = (s: string) => {
    if (s === 'pending')  return '<span class="badge badge-pending">⏳ Pending</span>';
    if (s === 'approved') return '<span class="badge badge-approved">✅ Approved</span>';
    if (s === 'rejected') return '<span class="badge badge-rejected">❌ Rejected</span>';
    return s;
  };

  container.innerHTML = `
    <div class="section-label">All Material Requests — ${requests.length} total</div>
    ${requests.length === 0 ? '<div class="empty-state"><div class="emoji">📋</div><p>No material requests found.</p></div>' : `
    <div>
      ${requests.map(r => {
        const invItem = typeof r.inventoryItemId === 'object' ? r.inventoryItemId : null;
        const proj    = typeof r.projectId === 'object' ? r.projectId : null;
        const leader  = typeof r.requestedBy === 'object' ? r.requestedBy : null;
        return `
          <div class="card request-card request-${r.status}" id="req-card-${r._id}">
            <div class="card-header">
              <div>
                <div class="card-title">${invItem ? invItem.name : '—'}</div>
                <div class="card-meta">
                  <span>📦 Qty: <strong>${r.quantity}</strong></span>
                  ${proj ? `<span>📂 <strong>${proj.name}</strong></span>` : ''}
                  ${leader ? `<span>👤 ${leader.name}</span>` : ''}
                  <span>📅 ${formatDate(r.createdAt)}</span>
                </div>
                ${r.reason ? `<div style="font-size:12px;color:var(--text-faint);margin-top:4px">💬 ${r.reason}</div>` : ''}
              </div>
              ${statusBadge(r.status)}
            </div>
            ${r.status === 'rejected' && r.rejectionReason ? `
              <div style="margin-top:8px;padding:10px;background:var(--danger-soft);border-radius:8px;font-size:13px;color:var(--danger)">
                ❌ ${r.rejectionReason}
              </div>` : ''}
            ${r.status === 'approved' ? `
              <div style="margin-top:8px;padding:10px;background:var(--success-soft);border-radius:8px;font-size:13px;color:var(--success)">
                ✅ Approved on ${r.reviewedAt ? formatDate(r.reviewedAt) : '—'}
              </div>` : ''}
            ${r.status === 'pending' ? `
              <div class="card-actions" style="margin-top:12px;flex-wrap:wrap">
                <button class="btn btn-primary btn-sm" data-approve-req="${r._id}">✅ Approve</button>
                <button class="btn btn-danger btn-sm" data-reject-req="${r._id}">❌ Reject</button>
              </div>
              <div id="reject-form-${r._id}" style="display:none;margin-top:10px">
                <div class="form-row">
                  <label>Rejection Reason *</label>
                  <textarea id="reject-reason-${r._id}" rows="2" placeholder="e.g. Item currently unavailable"></textarea>
                </div>
                <button class="btn btn-danger btn-sm" data-confirm-reject="${r._id}">Confirm Rejection</button>
                <button class="btn btn-ghost btn-sm" data-cancel-reject="${r._id}">Cancel</button>
              </div>` : ''}
          </div>`;
      }).join('')}
    </div>`}
  `;

  // Attach approve/reject listeners
  document.querySelectorAll('[data-approve-req]').forEach(btn => {
    const reqId = btn.getAttribute('data-approve-req')!;
    btn.addEventListener('click', async () => {
      if (!confirm('Approve this request? This will deduct inventory and add material to project.')) return;
      (btn as HTMLButtonElement).disabled = true;
      try {
        await api('PATCH', `/material-requests/${reqId}/approve`, { adminId: currentUserId });
        toast('Request approved! Inventory updated and material added.');
        allInventoryItems = await fetchInventory();
        renderH2AllRequests(container);
      } catch (e: unknown) {
        toast((e as Error).message, 'error');
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-reject-req]').forEach(btn => {
    const reqId = btn.getAttribute('data-reject-req')!;
    btn.addEventListener('click', () => {
      const form = document.getElementById(`reject-form-${reqId}`);
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  });

  document.querySelectorAll('[data-confirm-reject]').forEach(btn => {
    const reqId = btn.getAttribute('data-confirm-reject')!;
    btn.addEventListener('click', async () => {
      const reason = (document.getElementById(`reject-reason-${reqId}`) as HTMLTextAreaElement)?.value.trim();
      if (!reason) { toast('Rejection reason is required', 'error'); return; }
      (btn as HTMLButtonElement).disabled = true;
      try {
        await api('PATCH', `/material-requests/${reqId}/reject`, {
          adminId: currentUserId,
          rejectionReason: reason,
        });
        toast('Request rejected.');
        renderH2AllRequests(container);
      } catch (e: unknown) {
        toast((e as Error).message, 'error');
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-cancel-reject]').forEach(btn => {
    const reqId = btn.getAttribute('data-cancel-reject')!;
    btn.addEventListener('click', () => {
      const form = document.getElementById(`reject-form-${reqId}`);
      if (form) form.style.display = 'none';
    });
  });
}

// ── ALLOCATIONS TAB (admin) ───────────────────────────────────────────────────

async function renderH2Allocations(container: HTMLElement) {
  if (currentRole !== 'project_admin') {
    container.innerHTML = '<div class="empty-state"><div class="emoji">🔒</div><p>Access restricted to Project Admin.</p></div>';
    return;
  }

  if (!currentUserId) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">👤</div><p>Please enter your User ID first.</p></div>';
    return;
  }

  const result = await fetchAllAllocations(currentUserId);
  const allocations: InventoryAllocation[] = result.data;

  container.innerHTML = `
    <div class="section-label">Inventory Allocations — ${allocations.length} total</div>
    <p style="font-size:12px;color:var(--text-faint);margin-bottom:16px">Permanent history of Guitar inventory allocated to projects. There is no return workflow.</p>
    ${allocations.length === 0 ? '<div class="empty-state"><div class="emoji">📊</div><p>No allocations yet.</p></div>' : `
    <table class="team-table">
      <thead>
        <tr><th>Material</th><th>Project</th><th>Quantity</th><th>Allocated By</th><th>Date</th></tr>
      </thead>
      <tbody>
        ${allocations.map(a => {
          const item = typeof a.inventoryItemId === 'object' ? a.inventoryItemId : null;
          const proj = typeof a.projectId === 'object' ? a.projectId : null;
          const by   = typeof a.allocatedBy === 'object' ? a.allocatedBy : null;
          return `
            <tr>
              <td><strong>${item ? item.name : '—'}</strong></td>
              <td>${proj ? proj.name : '—'}</td>
              <td><span class="qty-badge">${a.quantity}</span></td>
              <td style="font-size:12px;color:var(--text-faint)">${by ? by.name : '—'}</td>
              <td style="font-size:12px;color:var(--text-faint)">${formatDate(a.allocatedAt)}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`}
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TASK 2I: NOTIFICATION HELPERS ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/** Fetch all notifications for current user and render the panel. */
async function loadNotifications() {
  if (!currentUserId) return;
  try {
    const data = await api<{ data: AppNotification[]; unreadCount: number }>(
      'GET', `/notifications?userId=${currentUserId}&limit=50`
    );
    notifList = data.data;
    notifUnreadCount = data.unreadCount;
    updateUnreadBadge();
    renderNotificationPanel();
  } catch { /* silently ignore if user not set */ }
}

/** Update the red badge on the bell icon. */
function updateUnreadBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (notifUnreadCount > 0) {
    badge.textContent = notifUnreadCount > 99 ? '99+' : String(notifUnreadCount);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/** Render the notification list inside the panel. */
function renderNotificationPanel() {
  const container = document.getElementById('notif-list');
  if (!container) return;

  if (!notifList.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:32px">
        <div class="emoji">🔕</div>
        <p>No notifications yet.</p>
      </div>`;
    return;
  }

  container.innerHTML = notifList.map(n => `
    <div class="notif-item ${n.isRead ? 'notif-read' : 'notif-unread'}" data-notif-id="${n._id}">
      <div class="notif-dot" ${n.isRead ? 'style="opacity:0"' : ''}></div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-message">${n.message}</div>
        <div class="notif-time">${formatDate(n.createdAt)}</div>
      </div>
    </div>`).join('');

  // Clicking an unread notification marks it as read
  container.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.notifId!;
      const notif = notifList.find(n => n._id === id);
      if (!notif || notif.isRead) return;
      try {
        await api('PATCH', `/notifications/${id}/read`, { userId: currentUserId });
        notif.isRead = true;
        notifUnreadCount = Math.max(0, notifUnreadCount - 1);
        updateUnreadBadge();
        renderNotificationPanel();
      } catch (e: unknown) { toast((e as Error).message, 'error'); }
    });
  });
}

/** Poll unread count every 30 seconds while a userId is set. */
function startNotifPolling() {
  if (notifPollInterval) clearInterval(notifPollInterval);
  notifPollInterval = window.setInterval(async () => {
    if (!currentUserId) return;
    try {
      const data = await api<{ count: number }>('GET', `/notifications/unread-count?userId=${currentUserId}`);
      notifUnreadCount = data.count;
      updateUnreadBadge();
    } catch { /* ignore */ }
  }, 30_000);
}

// Start polling immediately
startNotifPolling();
