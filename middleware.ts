import { NextRequest, NextResponse } from 'next/server';
import { RateLimitService } from '@/lib/auth/rate-limit';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;"
  );

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Allow specific origins in production, all in development
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
      : ['*'];

    const origin = request.headers.get('origin');
    
    if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers });
    }

    // Rate limiting for API routes
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const isAdminRoute = request.nextUrl.pathname.startsWith('/api/admin/');
    
    // Different rate limits for admin vs public routes
    const rateLimit = isAdminRoute ? 100 : 1000; // requests per hour
    const windowMs = 60 * 60 * 1000; // 1 hour

    try {
      const rateLimitResult = await RateLimitService.checkRateLimit(ip, rateLimit, windowMs);
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429, headers: response.headers }
        );
      }
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue on rate limiter errors to avoid blocking legitimate requests
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};