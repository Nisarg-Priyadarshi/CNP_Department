/**
 * Task 2J — Authentication Foundation (Frontend)
 *
 * This module is the application entry point.
 *
 * It implements:
 *  - AuthContext: centralized authentication state
 *  - Token storage / restoration on app startup
 *  - Login UI
 *  - Register UI
 *  - Protected routing: unauthenticated users see the login page
 *  - Automatic Authorization: Bearer header injection for all API calls
 *
 * After successful authentication the main application (app.ts) is
 * dynamically imported and rendered.
 */

import './app.css';

const API = 'http://localhost:5000/api';
const TOKEN_KEY = 'cnp_auth_token';

// ══════════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT
// Centralized authentication state — single source of truth
// ══════════════════════════════════════════════════════════════════════════════

interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  universityId?: string | null;
  phone?: string | null;
  bio?: string | null;
  profileImage?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

// The global auth state
export const auth: AuthState = {
  user: null,
  token: null,
  loading: true,
};

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  auth.token = token;
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  auth.token = null;
  auth.user = null;
}

// ── API call with automatic Authorization header ───────────────────────────────
// All authenticated requests MUST go through this function, NOT through the
// bare api() helper in app.ts.

export async function authFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: unknown = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, json };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
  const { status, json } = await authFetch('POST', '/auth/login', { email, password });
  const data = json as { success: boolean; token?: string; user?: AuthUser; message?: string };

  if (status === 200 && data.success && data.token && data.user) {
    storeToken(data.token);
    auth.user = data.user;
    return { success: true };
  }

  return { success: false, message: data.message || 'Login failed. Please try again.' };
}

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  role: string;
  department?: string;
  universityId?: string;
  phone?: string;
  bio?: string;
}): Promise<{ success: boolean; message?: string }> {
  const { status, json } = await authFetch('POST', '/auth/register', payload);
  const data = json as { success: boolean; token?: string; user?: AuthUser; message?: string };

  if ((status === 200 || status === 201) && data.success && data.token && data.user) {
    storeToken(data.token);
    auth.user = data.user;
    return { success: true };
  }

  return { success: false, message: data.message || 'Registration failed. Please try again.' };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  try {
    await authFetch('POST', '/auth/logout');
  } catch { /* ignore network errors on logout */ }
  clearToken();
  // Re-render the auth page (login screen)
  renderAuthPage();
}

// ── Restore session on startup ────────────────────────────────────────────────

async function restoreSession(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  auth.token = token;

  const { status, json } = await authFetch('GET', '/auth/me');
  const data = json as { success: boolean; data?: AuthUser; message?: string };

  if (status === 200 && data.success && data.data) {
    auth.user = data.data;
    return true;
  }

  // Token is invalid or expired — clear it
  clearToken();
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN UI
// ══════════════════════════════════════════════════════════════════════════════

function renderLogin(app: HTMLElement, errorMsg?: string) {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="dot"></div>
          <span>CNP Department</span>
        </div>
        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-sub">Sign in to your account to continue</p>

        ${errorMsg ? `<div class="auth-error" id="auth-error" role="alert">${errorMsg}</div>` : '<div id="auth-error" class="auth-error" style="display:none"></div>'}

        <form id="form-login" novalidate>
          <div class="auth-field">
            <label for="login-email">Email address</label>
            <input
              type="email"
              id="login-email"
              name="email"
              autocomplete="email"
              placeholder="you@university.edu"
              required
            />
          </div>
          <div class="auth-field">
            <label for="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              name="password"
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary auth-submit" id="btn-login">
            Sign In
          </button>
        </form>

        <p class="auth-switch">
          Don't have an account?
          <a href="#" id="link-to-register">Create one</a>
        </p>
      </div>
      <div id="toast-container"></div>
    </div>
  `;

  document.getElementById('form-login')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = (document.getElementById('login-email')    as HTMLInputElement).value.trim();
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    const errEl    = document.getElementById('auth-error')!;
    const btn      = document.getElementById('btn-login') as HTMLButtonElement;

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const result = await login(email, password);
    if (result.success) {
      // Load the main application
      await loadMainApp();
    } else {
      errEl.textContent = result.message || 'Invalid credentials';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  document.getElementById('link-to-register')!.addEventListener('click', (e) => {
    e.preventDefault();
    renderRegister(app);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// REGISTER UI
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_ROLES = [
  { value: 'student',             label: 'Student' },
  { value: 'faculty_coordinator', label: 'Faculty Coordinator' },
  { value: 'faculty_mentor',      label: 'Faculty Mentor' },
  { value: 'club_admin',          label: 'Club Admin' },
  { value: 'project_admin',       label: 'Project Admin' },
];

function renderRegister(app: HTMLElement, errorMsg?: string) {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card auth-card-wide">
        <div class="auth-brand">
          <div class="dot"></div>
          <span>CNP Department</span>
        </div>
        <h1 class="auth-title">Create account</h1>
        <p class="auth-sub">Join the Student Clubs &amp; Projects portal</p>

        <div id="auth-error" class="auth-error" style="${errorMsg ? '' : 'display:none'}">${errorMsg || ''}</div>

        <form id="form-register" novalidate>
          <div class="auth-grid">
            <div class="auth-field">
              <label for="reg-name">Full Name *</label>
              <input type="text" id="reg-name" name="name" autocomplete="name"
                placeholder="e.g. Priya Sharma" required />
            </div>
            <div class="auth-field">
              <label for="reg-email">Email *</label>
              <input type="email" id="reg-email" name="email" autocomplete="email"
                placeholder="you@university.edu" required />
            </div>
            <div class="auth-field">
              <label for="reg-password">Password * <span class="auth-hint">(min 8 chars)</span></label>
              <input type="password" id="reg-password" name="password" autocomplete="new-password"
                placeholder="••••••••" required minlength="8" />
            </div>
            <div class="auth-field">
              <label for="reg-role">Role *</label>
              <select id="reg-role" name="role" required>
                <option value="">— Select your role —</option>
                ${ALLOWED_ROLES.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
              </select>
            </div>
            <div class="auth-field">
              <label for="reg-dept">Department</label>
              <input type="text" id="reg-dept" name="department"
                placeholder="e.g. Computer Science" />
            </div>
            <div class="auth-field">
              <label for="reg-uid">University ID</label>
              <input type="text" id="reg-uid" name="universityId"
                placeholder="e.g. CS2024001" />
            </div>
            <div class="auth-field">
              <label for="reg-phone">Phone</label>
              <input type="tel" id="reg-phone" name="phone"
                placeholder="e.g. +91 9876543210" />
            </div>
            <div class="auth-field auth-field-full">
              <label for="reg-bio">Bio</label>
              <textarea id="reg-bio" name="bio" rows="2"
                placeholder="A short introduction about yourself…"></textarea>
            </div>
          </div>

          <button type="submit" class="btn btn-primary auth-submit" id="btn-register">
            Create Account
          </button>
        </form>

        <p class="auth-switch">
          Already have an account?
          <a href="#" id="link-to-login">Sign in</a>
        </p>
      </div>
      <div id="toast-container"></div>
    </div>
  `;

  document.getElementById('form-register')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error')!;
    const btn   = document.getElementById('btn-register') as HTMLButtonElement;

    const name        = (document.getElementById('reg-name')     as HTMLInputElement).value.trim();
    const email       = (document.getElementById('reg-email')    as HTMLInputElement).value.trim();
    const password    = (document.getElementById('reg-password') as HTMLInputElement).value;
    const role        = (document.getElementById('reg-role')     as HTMLSelectElement).value;
    const department  = (document.getElementById('reg-dept')     as HTMLInputElement).value.trim();
    const universityId = (document.getElementById('reg-uid')     as HTMLInputElement).value.trim();
    const phone       = (document.getElementById('reg-phone')    as HTMLInputElement).value.trim();
    const bio         = (document.getElementById('reg-bio')      as HTMLTextAreaElement).value.trim();

    // Client-side basic validation
    if (!name || !email || !password || !role) {
      errEl.textContent = 'Please fill in all required fields.';
      errEl.style.display = 'block';
      return;
    }
    if (password.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.';
      errEl.style.display = 'block';
      return;
    }

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    const result = await register({
      name, email, password, role,
      department:   department   || undefined,
      universityId: universityId || undefined,
      phone:        phone        || undefined,
      bio:          bio          || undefined,
    });

    if (result.success) {
      await loadMainApp();
    } else {
      errEl.textContent = result.message || 'Registration failed. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });

  document.getElementById('link-to-login')!.addEventListener('click', (e) => {
    e.preventDefault();
    renderLogin(app);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP LOADER
// Dynamically imports app.ts after authentication is confirmed
// ══════════════════════════════════════════════════════════════════════════════

async function loadMainApp() {
  const app = document.getElementById('app')!;
  // Clear auth UI
  app.innerHTML = '<div class="auth-page"><div class="empty-state"><div class="spinner"></div><p>Loading…</p></div></div>';

  // Inject the auth token into the global API helper used by app.ts
  // We do this by setting a window-level variable that app.ts can read
  (window as Window & typeof globalThis & { __cnp_auth_token__: string | null })
    .__cnp_auth_token__ = auth.token;
  (window as Window & typeof globalThis & { __cnp_auth_user__: AuthUser | null })
    .__cnp_auth_user__ = auth.user;

  // Dynamically import the main application module
  // This allows auth to initialize before the app renders
  try {
    await import('./app.ts');
  } catch (err) {
    console.error('Failed to load main app:', err);
    app.innerHTML = '<div class="auth-page"><div class="auth-card"><p style="color:var(--danger)">Failed to load application. Please refresh.</p></div></div>';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER AUTH PAGE (LOGIN / REGISTER)
// ══════════════════════════════════════════════════════════════════════════════

function renderAuthPage() {
  const app = document.getElementById('app')!;
  renderLogin(app);
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOT — Protected Route Guard
// ══════════════════════════════════════════════════════════════════════════════

async function boot() {
  const app = document.getElementById('app')!;

  // Show loading spinner while checking stored session
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card" style="text-align:center;padding:40px">
        <div class="dot" style="margin:0 auto 16px"></div>
        <div class="spinner" style="margin:0 auto"></div>
        <p style="margin-top:16px;color:var(--text-faint);font-size:14px">Restoring session…</p>
      </div>
    </div>
  `;

  auth.loading = true;

  const isAuthenticated = await restoreSession();
  auth.loading = false;

  if (isAuthenticated) {
    // ✅ Valid session — load the main application
    await loadMainApp();
  } else {
    // 🔒 No valid session — show the login page
    renderAuthPage();
  }
}

// Start the application
boot();
