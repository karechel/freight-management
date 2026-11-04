// Calls the backend while rendering a page on the server. The token stays in its
// HttpOnly cookie and is only ever added here or in the same-origin route handler.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { CurrentUser } from './browser';
import { callBackend, SESSION_COOKIE } from './session';

export type ServerResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const signInUrl = (returnTo: string) => `/login?next=${encodeURIComponent(returnTo)}`;

/**
 * Reads from the backend on behalf of the signed-in user. Someone who is signed out, or
 * whose session has ended, is sent to the sign-in page and then back to `returnTo`.
 */
export async function serverGet<T>(path: string, returnTo: string): Promise<ServerResult<T>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect(signInUrl(returnTo));

  const response = await callBackend(path, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) redirect(signInUrl(returnTo));

  const payload = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: payload as T };
  return { ok: false, status: response.status, message: payload?.message ?? 'The request failed.' };
}

export const getCurrentUser = (returnTo: string) => serverGet<CurrentUser>('auth/me', returnTo);
