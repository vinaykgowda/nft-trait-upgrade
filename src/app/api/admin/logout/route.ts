import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { SessionService, CSRFService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Get the current session token for audit logging
    const sessionToken = request.cookies.get('admin-session')?.value;
    if (sessionToken) {
      await authService.logout(sessionToken, ipAddress, userAgent);
    }

    const response = NextResponse.json({ success: true });

    // Clear session and CSRF cookies
    SessionService.clearSessionCookie();
    CSRFService.clearCSRFCookie();

    return response;

  } catch (error) {
    console.error('Logout API error:', error);
    
    // Even if there's an error, we should clear the cookies
    const response = NextResponse.json({ success: true });
    SessionService.clearSessionCookie();
    CSRFService.clearCSRFCookie();
    
    return response;
  }
}