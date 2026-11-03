import { NextResponse, type NextRequest } from 'next/server';
import { callBackend, errorResponse, isCrossSite, SESSION_COOKIE } from '@/lib/api/session';

type Context = { params: Promise<{ path: string[] }> };

/** Forwards a browser request to the backend's /api routes, adding the session token. */
async function forward(request: NextRequest, { params }: Context) {
  if (request.method !== 'GET' && isCrossSite(request)) {
    return errorResponse(403, 'Forbidden', 'Cross-site request refused.');
  }
  const { path } = await params;
  if (path.some((segment) => segment === '.' || segment === '..')) {
    return errorResponse(400, 'Bad Request', 'Invalid path.');
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const hasBody = !['GET', 'DELETE'].includes(request.method);
  if (hasBody) headers['Content-Type'] = 'application/json';

  const backend = await callBackend(`${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : undefined,
  });

  const response = new NextResponse(backend.status === 204 ? null : await backend.text(), {
    status: backend.status,
    headers: { 'Content-Type': backend.headers.get('content-type') ?? 'application/json' },
  });
  // An expired or disabled session: forget it, so the browser shows "signed out".
  if (backend.status === 401 && token) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
