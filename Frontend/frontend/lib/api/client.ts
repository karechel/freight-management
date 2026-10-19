// Thin client for the NestJS backend. All real HTTP calls go through here.
// The base URL comes from NEXT_PUBLIC_API_URL (see .env.example); nothing
// machine-specific is hard-coded.

export class ApiNotConfiguredError extends Error {
  constructor() {
    super('NEXT_PUBLIC_API_URL is not set');
    this.name = 'ApiNotConfiguredError';
  }
}

export function getApiBaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  return url ? url.replace(/\/+$/, '') : undefined;
}

/** Requests that take longer than this are aborted, so the UI never waits indefinitely. */
const REQUEST_TIMEOUT_MS = 8000;

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new ApiNotConfiguredError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort, { once: true });
  try {
    const response = await fetch(`${base}${path}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`GET ${path} failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** Shape returned by the existing backend `GET /health` (app.service.ts). */
export interface HealthResponse {
  status: string;
  message: string;
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health', signal);
}
