import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Login from './Login';
import { AuthProvider } from '../../context/AuthContext';
import { makeUser, mockResponse, stubFetch, urlFor } from '../../test/fixtures';
import { API_URL } from '../../services/api';

function renderLogin(initialEntry: string | { pathname: string; state?: unknown } = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<h1>Dashboard home</h1>} />
          <Route path="/profile" element={<h1>Complete your profile</h1>} />
          <Route path="/inventory" element={<h1>Inventory board</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(email = 'asha@college.edu', password = 'secret') {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('College email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('Login page', () => {
  it('renders the sign-in form with labelled fields', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('College email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('toggles password visibility without submitting', async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('posts the typed credentials and lands on the dashboard for a complete profile', async () => {
    const fetchMock = stubFetch(async () =>
      mockResponse({ success: true, token: 'jwt-login', user: makeUser() }),
    );
    renderLogin();

    await fillAndSubmit();

    expect(await screen.findByRole('heading', { name: 'Dashboard home' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      urlFor(API_URL, '/auth/login'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: 'asha@college.edu', password: 'secret' }),
      }),
    );
    expect(localStorage.getItem('cnp_auth_token')).toBe('jwt-login');
  });

  it('sends an incomplete student to the profile screen instead', async () => {
    stubFetch(async () =>
      mockResponse({
        success: true,
        token: 'jwt-login',
        user: makeUser({ semester: undefined }),
      }),
    );
    renderLogin();

    await fillAndSubmit();

    expect(await screen.findByRole('heading', { name: 'Complete your profile' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard home' })).not.toBeInTheDocument();
  });

  it('returns to the page the guard remembered', async () => {
    stubFetch(async () => mockResponse({ success: true, token: 'jwt-login', user: makeUser() }));
    renderLogin({ pathname: '/login', state: { from: { pathname: '/inventory' } } });

    await fillAndSubmit();

    expect(await screen.findByRole('heading', { name: 'Inventory board' })).toBeInTheDocument();
  });

  it('shows the API error message and stays on the form', async () => {
    stubFetch(async () => mockResponse({ success: false, message: 'Invalid credentials' }, 401));
    renderLogin();

    await fillAndSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid credentials');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Dashboard home' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('College email')).toHaveAttribute('aria-describedby', 'login-error');
  });

  it('falls back to a readable message when the API sends no message', async () => {
    stubFetch(async () => mockResponse({ success: false }, 401));
    renderLogin();

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Authentication required');
  });

  it('shows the message from a 200 response that reports success: false', async () => {
    stubFetch(async () => mockResponse({ success: false, message: 'Account not verified' }));
    renderLogin();

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Account not verified');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('validates empty fields locally without calling the API', async () => {
    const fetchMock = stubFetch(async () => mockResponse({ success: true }));
    renderLogin();

    await fillAndSubmit('', '');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter your email address and password to continue.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
