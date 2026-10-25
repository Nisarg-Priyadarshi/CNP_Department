import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { makeUser, mockResponse, stubFetch, urlFor } from '../test/fixtures';
import { API_URL } from '../services/api';

const TOKEN_KEY = 'cnp_auth_token';

function Probe() {
  const { user, token, loading, login, logout, updateUser } = useAuth();
  return (
    <div>
      <p data-testid="loading">{String(loading)}</p>
      <p data-testid="user">{user?.name ?? 'none'}</p>
      <p data-testid="token">{token ?? 'none'}</p>
      <button onClick={() => login('jwt-9', makeUser({ name: 'New User' }))}>log in</button>
      <button onClick={logout}>log out</button>
      <button onClick={() => updateUser(makeUser({ name: 'Renamed User' }))}>rename</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider bootstrap', () => {
  it('finishes loading with no user when no token is stored, without calling the API', async () => {
    const fetchMock = stubFetch(async () => mockResponse({ success: true }));

    renderAuth();

    expect(await screen.findByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores the session from /auth/me when a token is stored', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-jwt');
    const fetchMock = stubFetch(async () => mockResponse({ success: true, data: makeUser() }));

    renderAuth();

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByTestId('token')).toHaveTextContent('stored-jwt');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(fetchMock).toHaveBeenCalledWith(
      urlFor(API_URL, '/auth/me'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer stored-jwt' }),
      }),
    );
  });

  it('drops an invalid stored token when /auth/me rejects it', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-jwt');
    stubFetch(async () => mockResponse({ message: 'Authentication required' }, 401));

    renderAuth();

    expect(await screen.findByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('drops the stored token when /auth/me succeeds without a user payload', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-jwt');
    stubFetch(async () => mockResponse({ success: false }));

    renderAuth();

    expect(await screen.findByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('token')).toHaveTextContent('none');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('AuthProvider actions', () => {
  it('login() stores the token and exposes the user', async () => {
    const user = userEvent.setup();
    stubFetch(async () => mockResponse({ success: true }));
    renderAuth();

    await user.click(screen.getByRole('button', { name: 'log in' }));

    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-9');
    expect(screen.getByTestId('token')).toHaveTextContent('jwt-9');
    expect(screen.getByTestId('user')).toHaveTextContent('New User');
  });

  it('logout() clears local state, removes the token and notifies the API', async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(async () => mockResponse({ success: true }));
    renderAuth();

    await user.click(screen.getByRole('button', { name: 'log in' }));
    await user.click(screen.getByRole('button', { name: 'log out' }));

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId('token')).toHaveTextContent('none');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(fetchMock).toHaveBeenCalledWith(
      urlFor(API_URL, '/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('updateUser() replaces the user without touching the token', async () => {
    const user = userEvent.setup();
    stubFetch(async () => mockResponse({ success: true }));
    renderAuth();

    await user.click(screen.getByRole('button', { name: 'log in' }));
    await user.click(screen.getByRole('button', { name: 'rename' }));

    expect(screen.getByTestId('user')).toHaveTextContent('Renamed User');
    expect(screen.getByTestId('token')).toHaveTextContent('jwt-9');
  });
});

describe('useAuth()', () => {
  it('throws outside an AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });
});
