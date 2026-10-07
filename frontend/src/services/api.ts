export const API_URL = 'http://localhost:5000/api';

export function getStoredToken(): string | null {
  return localStorage.getItem('cnp_auth_token');
}

export async function api<T>(method: string, endpoint: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'API Request Failed');
  }

  return data as T;
}
