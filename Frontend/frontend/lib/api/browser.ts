// Calls the backend from client components, through the same-origin /api/backend
// route, which adds the session token. Failures become ApiError with field details.

export interface ApiFieldProblem {
  field: string;
  messages: string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: ApiFieldProblem[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The first message for each field, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.field, d.messages[0]]));
  }
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(503, 'The server could not be reached.');
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? 'The request failed.', payload?.details ?? []);
  }
  return payload as T;
}

const backendPath = (path: string) => `/api/backend/${path.replace(/^\/+/, '')}`;

export const backend = {
  get: <T>(path: string) => send<T>(backendPath(path), 'GET'),
  post: <T>(path: string, body: unknown) => send<T>(backendPath(path), 'POST', body),
  patch: <T>(path: string, body: unknown) => send<T>(backendPath(path), 'PATCH', body),
  delete: <T = void>(path: string) => send<T>(backendPath(path), 'DELETE'),
};

export interface CurrentUser {
  id: number;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}

export const signInRequest = (email: string, password: string) =>
  send<{ user: CurrentUser }>('/api/auth/login', 'POST', { email, password });

export const signOutRequest = () => send<void>('/api/auth/logout', 'POST', {});
