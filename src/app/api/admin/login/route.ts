import { NextRequest, NextResponse } from 'next/server';
import { authService, SessionService, CSRFService } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function GET() {
  return NextResponse.json({ 
    message: 'Admin login endpoint - use POST method',
    status: 'available'
  });
}

export async function POST(request: NextRequest) {
  try {
    // Handle both JSON and form data
    let body;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = {
        username: formData.get('username'),
        password: formData.get('password'),
      };
    } else {
      // Try to parse as form data by default
      const formData = await request.formData();
      body = {
        username: formData.get('username'),
        password: formData.get('password'),
      };
    }
    
    const { username, password } = loginSchema.parse(body);

    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const result = await authService.login(username, password, ipAddress, userAgent);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          rateLimited: result.rateLimited,
          accountLocked: result.accountLocked,
        },
        { status: 401 }
      );
    }

    // Generate CSRF token
    const csrfToken = CSRFService.generateToken();

    const response = NextResponse.json({
      success: true,
      user: result.user,
      requiresMFA: result.requiresMFA,
      csrfToken,
    });

    // Set session cookie on the response
    if (result.token) {
      response.cookies.set('admin-session', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60, // 24 hours in seconds
        path: '/',
      });
    }

    // Set CSRF cookie on the response
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: false, // CSRF token needs to be accessible to client
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Login API error:', error);
    
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