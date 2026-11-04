import { NextResponse, type NextRequest } from 'next/server';
import { callBackend, errorResponse, isCrossSite, setSessionCookie } from '@/lib/api/session';

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return errorResponse(403, 'Forbidden', 'Cross-site request refused.');

  const backend = await callBackend('auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: await request.text(),
  });
  const payload = await backend.json();
  if (!backend.ok) return NextResponse.json(payload, { status: backend.status });

  // The token stays in the cookie; the page only receives the user.
  const response = NextResponse.json({ user: payload.user });
  setSessionCookie(response, payload.accessToken, payload.expiresIn);
  return response;
}
