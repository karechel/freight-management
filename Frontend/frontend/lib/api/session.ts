// Shared by the same-origin route handlers in app/api. The login token lives in an
// HttpOnly cookie, so page scripts can never read it; these handlers attach it to
// requests going to the NestJS backend.

import { NextResponse, type NextRequest } from 'next/server';
import { getApiBaseUrl } from './client';

export const SESSION_COOKIE = 'fm_session';

const BACKEND_TIMEOUT_MS = 15000;

export function errorResponse(statusCode: number, error: string, message: string) {
  return NextResponse.json({ statusCode, error, message, details: [] }, { status: statusCode });
}

/** Refuses state-changing requests started by another site. */
export function isCrossSite(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return false;
  try {
    return new URL(origin).host !== request.headers.get('host');
  } catch {
    // Browsers send "null" for sandboxed pages, which is not a URL: treat it as another site.
    return true;
  }
}

/** Calls the backend, or returns a 503 response when it cannot be reached. */
export async function callBackend(path: string, init: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  if (!base) return errorResponse(503, 'Service Unavailable', 'The API address is not configured.');
  try {
    return await fetch(`${base}/api/${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch {
    return errorResponse(503, 'Service Unavailable', 'The API is not reachable.');
  }
}

export function setSessionCookie(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}
