import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute, RoleProtectedRoute } from './ProtectedRoute';
import { makeUser } from '../test/fixtures';
import type { User } from '../types';

const authState = vi.hoisted(() => ({
  current: { user: null as User | null, loading: false },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState.current,
}));

beforeEach(() => {
  authState.current = { user: null, loading: false };
});

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  return <div>Login screen from {from ?? 'nowhere'}</div>;
}

function renderGuarded(route: string, guard: 'auth' | 'role') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={guard === 'auth' ? <ProtectedRoute /> : <RoleProtectedRoute allowedRoles={['project_admin']} />}>
          <Route path="/dashboard" element={<h1>Protected dashboard</h1>} />
          <Route path="/inventory" element={<h1>Protected inventory</h1>} />
        </Route>
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows the loading screen while auth is bootstrapping', () => {
    authState.current = { user: null, loading: true };

    renderGuarded('/dashboard', 'auth');

    expect(screen.getByRole('status', { name: 'Loading workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protected dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Login screen/)).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to /login and remembers where they came from', () => {
    authState.current = { user: null, loading: false };

    renderGuarded('/dashboard', 'auth');

    expect(screen.getByText('Login screen from /dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protected dashboard' })).not.toBeInTheDocument();
  });

  it('renders the outlet for an authenticated user', () => {
    authState.current = { user: makeUser(), loading: false };

    renderGuarded('/dashboard', 'auth');

    expect(screen.getByRole('heading', { name: 'Protected dashboard' })).toBeInTheDocument();
    expect(screen.queryByText(/Login screen/)).not.toBeInTheDocument();
  });
});

describe('RoleProtectedRoute', () => {
  it('shows the loading screen while auth is bootstrapping', () => {
    authState.current = { user: null, loading: true };

    renderGuarded('/inventory', 'role');

    expect(screen.getByRole('status', { name: 'Loading workspace' })).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to /login', () => {
    authState.current = { user: null, loading: false };

    renderGuarded('/inventory', 'role');

    expect(screen.getByText('Login screen from /inventory')).toBeInTheDocument();
  });

  it('rejects an authenticated user whose role is not allowed', () => {
    authState.current = { user: makeUser({ role: 'student' }), loading: false };

    renderGuarded('/inventory', 'role');

    expect(screen.getByRole('heading', { name: '403 Forbidden' })).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protected inventory' })).not.toBeInTheDocument();
  });

  it('allows an authenticated user whose role is allowed', () => {
    authState.current = { user: makeUser({ role: 'project_admin' }), loading: false };

    renderGuarded('/inventory', 'role');

    expect(screen.getByRole('heading', { name: 'Protected inventory' })).toBeInTheDocument();
    expect(screen.queryByText('403 Forbidden')).not.toBeInTheDocument();
  });
});
