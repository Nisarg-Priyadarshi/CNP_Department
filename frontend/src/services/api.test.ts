import { describe, expect, it, vi } from 'vitest';
import { API_URL, ApiError, UNAUTHORIZED_EVENT, api, getStoredToken } from './api';
import { mockResponse, mockUnparsableResponse, stubFetch, urlFor } from '../test/fixtures';

const TOKEN_KEY = 'cnp_auth_token';

describe('api()', () => {
  it('calls fetch with the API base URL and the endpoint', async () => {
    const fetchMock = stubFetch(async () => mockResponse({ success: true }));

    await api('GET', '/clubs');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(urlFor(API_URL, '/clubs'));
  });

  it('returns the parsed JSON body', async () => {
    stubFetch(async () => mockResponse({ success: true, data: { id: 'club-1', name: 'Robotics' } }));

    const result = await api<{ success: boolean; data: { id: string; name: string } }>('GET', '/clubs/c1');

    expect(result).toEqual({ success: true, data: { id: 'club-1', name: 'Robotics' } });
  });

  describe('headers', () => {
    it('sets Content-Type: application/json for an object body', async () => {
      const fetchMock = stubFetch(async () => mockResponse({ success: true }));

      await api('POST', '/clubs', { name: 'Robotics' });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('omits Content-Type on a bodyless request, keeping it a simple request', async () => {
      const fetchMock = stubFetch(async () => mockResponse({ success: true }));

      await api('GET', '/events');

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.headers).not.toHaveProperty('Content-Type');
      expect(init.body).toBeUndefined();
    });

    it('omits Authorization when no token is stored', async () => {
      localStorage.removeItem(TOKEN_KEY);
      const fetchMock = stubFetch(async () => mockResponse({ success: true }));

      await api('GET', '/auth/me');

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.headers).not.toHaveProperty('Authorization');
    });

    it('attaches the stored token as a Bearer header', async () => {
      localStorage.setItem(TOKEN_KEY, 'jwt-abc-123');
      const fetchMock = stubFetch(async () => mockResponse({ success: true }));

      await api('GET', '/auth/me');

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-abc-123' });
    });
  });

  describe('body handling', () => {
    it('serialises a plain object body', async () => {
      const payload = { email: 'asha@college.edu', password: 'secret' };
      const fetchMock = stubFetch(async () => mockResponse({ success: true }));

      await api('POST', '/auth/login', payload);

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe(JSON.stringify(payload));
    });

    it('passes FormData through untouched and does not set Content-Type', async () => {
      const form = new FormData();
      form.append('file', 'contents');
      const fetchMock = stubFetch(async () => mockResponse({ success: true }));

      await api('POST', '/clubs/c1/logo', form);

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe(form);
      expect(init.headers).not.toHaveProperty('Content-Type');
      expect(init.headers).not.toHaveProperty('content-type');
    });

    it('still sends Authorization with a FormData body', async () => {
      localStorage.setItem(TOKEN_KEY, 'jwt-form');
      const fetchMock = stubFetch(async () => mockResponse({ success: true }));
      const form = new FormData();

      await api('POST', '/projects/p1/image', form);

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-form' });
    });
  });

  describe('errors', () => {
    it('throws ApiError with status and payload on a non-OK response', async () => {
      stubFetch(async () => mockResponse({ success: false, message: 'Club not found' }, 404));

      const error = await api('GET', '/clubs/missing').catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        name: 'ApiError',
        status: 404,
        message: 'Club not found',
        data: { success: false, message: 'Club not found' },
      });
    });

    it.each([
      [401, 'Authentication required'],
      [403, 'Access forbidden'],
      [404, 'Resource not found'],
      [500, 'API Request Failed'],
      [418, 'API Request Failed'],
    ])('falls back to a status-specific message when %i has no payload message', async (status, expected) => {
      stubFetch(async () => mockResponse({ success: false }, status));

      const error = await api('GET', '/x').catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status, message: expected });
    });

    it('survives a non-JSON error body', async () => {
      stubFetch(async () => mockUnparsableResponse(502));

      const error = await api('GET', '/x').catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 502, message: 'API Request Failed', data: null });
    });

    it('wraps a network failure in ApiError instead of leaking the TypeError', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });

      const error = await api('GET', '/clubs').catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).not.toBeInstanceOf(TypeError);
      expect(error).toMatchObject({ status: 0, message: 'Failed to fetch', data: undefined });
    });

    it('uses a readable fallback when the network error has no message', async () => {
      stubFetch(async () => {
        throw new Error();
      });

      const error = await api('GET', '/clubs').catch((thrown: unknown) => thrown);

      expect(error).toMatchObject({ status: 0, message: 'Network error: unable to connect to server' });
    });

    it('clears the stored token on a 401 and signals the shell', async () => {
      localStorage.setItem(TOKEN_KEY, 'expired-token');
      stubFetch(async () => mockResponse({ message: 'Authentication required' }, 401));
      const listener = vi.fn();
      window.addEventListener(UNAUTHORIZED_EVENT, listener);

      await expect(api('GET', '/auth/me')).rejects.toBeInstanceOf(ApiError);

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    });

    it('does not clear the token for a rejected sign-in, which is about credentials', async () => {
      localStorage.setItem(TOKEN_KEY, 'still-valid');
      stubFetch(async () => mockResponse({ message: 'Invalid credentials' }, 401));
      const listener = vi.fn();
      window.addEventListener(UNAUTHORIZED_EVENT, listener);

      await expect(api('POST', '/auth/login', { email: 'a', password: 'b' })).rejects.toBeInstanceOf(ApiError);

      expect(localStorage.getItem(TOKEN_KEY)).toBe('still-valid');
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    });
  });
});

describe('API_URL', () => {
  it('never carries a trailing slash', () => {
    expect(API_URL.endsWith('/')).toBe(false);
  });

  it('normalises trailing slashes out of VITE_API_URL', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.example.test/v1///');

    const fresh = await import('./api');

    expect(fresh.API_URL).toBe('https://api.example.test/v1');
    vi.resetModules();
  });
});

describe('getStoredToken()', () => {
  it('reads the cnp_auth_token key only', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-1');
    localStorage.setItem('some_other_token', 'nope');

    expect(getStoredToken()).toBe('jwt-1');

    localStorage.removeItem(TOKEN_KEY);
    expect(getStoredToken()).toBeNull();
  });
});
