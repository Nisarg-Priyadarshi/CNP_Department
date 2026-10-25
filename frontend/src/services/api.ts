export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

export function getStoredToken(): string | null {
  return localStorage.getItem('cnp_auth_token');
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** A 401 from these is an answer about credentials, not an expired session. */
function isCredentialEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
}

/**
 * Signals that the session is over. AuthProvider listens and drops the user;
 * the token is already gone, so nothing in flight can resurrect the session.
 */
export const UNAUTHORIZED_EVENT = 'cnp:unauthorized';

export async function api<T>(method: string, endpoint: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {};
  const hasBody = body !== undefined && body !== null;

  // A bodyless request is a simple request: no content type, no preflight.
  if (hasBody && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch (err: any) {
    throw new ApiError(err?.message || 'Network error: unable to connect to server', 0);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    // An expired session should not linger as a ghost token that makes every
    // later request fail silently. Drop it and let the shell react.
    if (response.status === 401 && !isCredentialEndpoint(endpoint) && getStoredToken()) {
      localStorage.removeItem('cnp_auth_token');
      try {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      } catch {
        /* non-browser environment */
      }
    }

    const defaultMsg =
      response.status === 401
        ? 'Authentication required'
        : response.status === 403
          ? 'Access forbidden'
          : response.status === 404
            ? 'Resource not found'
            : 'API Request Failed';
    const message = data?.message || defaultMsg;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

