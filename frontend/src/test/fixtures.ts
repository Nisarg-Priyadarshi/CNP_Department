import { vi } from 'vitest';
import type { User } from '../types';

/** A complete student profile; override one field to make a specific case. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    _id: 'user-1',
    name: 'Asha Rao',
    email: 'asha@college.edu',
    role: 'student',
    department: 'Computer Science',
    phone: '+91 90000 00000',
    universityId: 'U-2026-0142',
    semester: 4,
    ...overrides,
  };
}

/** A minimal stand-in for a JSON `Response`; no dependence on the runtime's Response. */
export function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A response whose body cannot be parsed as JSON (an HTML 502, for example). */
export function mockUnparsableResponse(status = 500): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  } as unknown as Response;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Install a per-test `fetch` stub. The setup file restores globals after each test. */
export function stubFetch(implementation: FetchLike) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The URL `api()` is expected to call for a given endpoint. */
export function urlFor(apiUrl: string, endpoint: string): string {
  return `${apiUrl}${endpoint}`;
}
