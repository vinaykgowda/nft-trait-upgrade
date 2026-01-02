import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { SessionService } from '@/lib/auth';
import { z } from 'zod';

const mfaSchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits').regex(/^\d{6}$/, 'MFA token must be numeric'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = mfaSchema.parse(body);

    // Get session token from cookies
    const sessionData = await SessionService.getSessionFromCookies();
    if (!sessionData) {
      return NextResponse.json(
        { error: 'No valid session found' },
        { status: 401 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Get the current session token (we need to reconstruct it)
    const sessionToken = request.cookies.get('admin-session')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No session token found' },
        { status: 401 }
      );
    }

    const result = await authService.verifyMFA(sessionToken, token, ipAddress, userAgent);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          rateLimited: result.rateLimited,
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
    });

    // Update session cookie with MFA verification
    if (result.token) {
      SessionService.setSessionCookie(result.token);
    }

    return response;

  } catch (error) {
    console.error('MFA verification API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}