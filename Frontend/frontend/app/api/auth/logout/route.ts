import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, isCrossSite, SESSION_COOKIE } from '@/lib/api/session';

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return errorResponse(403, 'Forbidden', 'Cross-site request refused.');

  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
