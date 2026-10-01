/**
 * Task 2F — Project Updates & Mentor Feedback Frontend
 *
 * Single-page application (vanilla TS + Vite).
 * Communicates with backend at http://localhost:5000.
 *
 * Roles supported:
 *   - student      → create updates, view updates, view feedback for own projects
 *   - faculty_mentor → view updates, add feedback for assigned projects
 *   - project_admin  → view updates + feedback for any project
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

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

let currentUserId  = '';
let currentRole    = 'student';
let currentProjectId = '';
let allProjects: Project[] = [];
let activeTab      = 'updates';

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
// FETCH HELPERS
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
// RENDER FUNCTIONS
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
// ACTIONS
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
  // Remove any existing modal
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
// MAIN RENDER
// ══════════════════════════════════════════════════════════════════════════════

function renderApp() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <header>
      <div class="header-brand">
        <div class="dot"></div>
        CNP Department
      </div>
      <span class="header-badge">Task 2F</span>
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
            <option value="student"       ${currentRole === 'student'        ? 'selected' : ''}>Student</option>
            <option value="faculty_mentor" ${currentRole === 'faculty_mentor' ? 'selected' : ''}>Faculty Mentor</option>
            <option value="project_admin"  ${currentRole === 'project_admin'  ? 'selected' : ''}>Project Admin</option>
          </select>
        </div>
        <div class="form-row">
          <label for="project-select">Project</label>
          <select id="project-select">
            <option value="">— loading projects —</option>
          </select>
        </div>
        <button class="btn btn-primary" id="btn-load" style="flex-shrink:0">Load</button>
      </div>

      <!-- ─── Content area ─── -->
      <div id="content-area"></div>
    </main>

    <div id="toast-container"></div>
  `;

  // Wire config bar
  document.getElementById('btn-load')!.addEventListener('click', onLoad);
  document.getElementById('input-role')!.addEventListener('change', (e) => {
    currentRole = (e.target as HTMLSelectElement).value;
  });
  document.getElementById('project-select')!.addEventListener('change', (e) => {
    currentProjectId = (e.target as HTMLSelectElement).value;
  });

  // Pre-load project list for selector
  fetchProjects().then(p => { allProjects = p; renderProjectSelector(p); }).catch(() => {});
}

async function onLoad() {
  currentUserId    = (document.getElementById('input-user-id') as HTMLInputElement).value.trim();
  currentRole      = (document.getElementById('input-role') as HTMLSelectElement).value;
  currentProjectId = (document.getElementById('project-select') as HTMLSelectElement).value;

  if (!currentUserId) { toast('Please enter your User ID', 'error'); return; }

  // For student/mentor, load their specific projects
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

  renderContentArea();
}

function renderContentArea() {
  const area = document.getElementById('content-area')!;
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
    // Get current updates for the feedback add-form dropdown (only for mentor/admin)
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

    // Mentor/admin add feedback on a specific update from Updates tab
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
            mentorId: currentUserId,
            feedbackText,
            updateId: updateId || undefined,
          });
          toast('Feedback submitted!');
          form.reset();
        } catch (err: unknown) { toast((err as Error).message, 'error'); }
        finally { btn.disabled = false; }
      });
    }

    renderUpdatesTab();

  } else {
    // ── Feedback tab ─────────────────────────────────────────────────────
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

    // Populate update dropdown in feedback form
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
