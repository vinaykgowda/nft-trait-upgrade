import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

export async function GET() {
  return NextResponse.json({ 
    message: 'Simple admin login endpoint - use POST method',
    status: 'available'
  });
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ 
        error: 'Username and password are required' 
      }, { status: 400 });
    }

    // Connect to database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Find user
    const userResult = await pool.query(
      'SELECT id, username, password_hash, roles FROM admin_users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      await pool.end();
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordValid = await argon2.verify(user.password_hash, password);

    await pool.end();

    if (!passwordValid) {
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Create a simple session token
    const sessionToken = Buffer.from(JSON.stringify({
      userId: user.id,
      username: user.username,
      roles: user.roles,
      timestamp: Date.now()
    })).toString('base64');

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        roles: user.roles
      },
      sessionToken
    });

    // Set a simple session cookie
    response.cookies.set('admin-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Simple login error:', error);
    return NextResponse.json({ 
      error: 'Login failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}