import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

export async function POST(request: NextRequest) {
  try {
    console.log('Test login attempt...');
    
    const { username, password } = await request.json();
    console.log('Username:', username);

    if (!username || !password) {
      return NextResponse.json({ 
        error: 'Username and password are required' 
      }, { status: 400 });
    }

    console.log('Connecting to database...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Find user
    console.log('Looking for user...');
    const userResult = await pool.query(
      'SELECT id, username, password_hash, roles FROM admin_users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      await pool.end();
      return NextResponse.json({ 
        error: 'Invalid username or password' 
      }, { status: 401 });
    }

    const user = userResult.rows[0];
    console.log('User found:', user.username);

    // Verify password
    console.log('Verifying password...');
    const passwordValid = await argon2.verify(user.password_hash, password);
    console.log('Password valid:', passwordValid);

    await pool.end();

    if (!passwordValid) {
      return NextResponse.json({ 
        error: 'Invalid username or password' 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        roles: user.roles
      }
    });

  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json({ 
      error: 'Login failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}