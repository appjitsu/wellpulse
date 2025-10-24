/**
 * Auth Middleware
 *
 * Next.js middleware for route protection.
 * - Checks if user has access token
 * - Redirects to login if accessing protected routes without auth
 * - Allows access to public routes (auth pages, etc.)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check if user has access token (stored in cookie or would be in localStorage on client)
  // Note: Since middleware runs on edge, we can't access localStorage
  // We'll check for the refresh token cookie as a proxy for authentication
  const refreshToken = request.cookies.get('refreshToken');
  const isAuthenticated = !!refreshToken;

  // Check if current route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Check if current route is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Allow home page
  if (pathname === '/') {
    return NextResponse.next();
  }

  // If user is authenticated and trying to access auth routes, redirect to dashboard
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If route is public, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If user is not authenticated and trying to access protected route, redirect to login
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow access to protected routes if authenticated
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/).*)',
  ],
};
