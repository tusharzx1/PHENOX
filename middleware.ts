import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple passthrough middleware — Clerk auth handled at page level via useSignIn hook
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
