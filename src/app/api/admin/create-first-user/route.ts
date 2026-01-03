import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PasswordService } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow if no admin users exist
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Check if any admin users already exist
    const existingAdmins = await pool.query('SELECT COUNT(*) FROM admin_users');
    const adminCount = parseInt(existingAdmins.rows[0].count);

    if (adminCount > 0) {
      await pool.end();
      return NextResponse.json({ 
        error: 'Admin users already exist. Use the admin panel to create additional users.' 
      }, { status: 403 });
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      await pool.end();
      return NextResponse.json({ 
        error: 'Username and password are required' 
      }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = PasswordService.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      await pool.end();
      return NextResponse.json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      }, { status: 400 });
    }

    // Hash the password
    const passwordHash = await PasswordService.hash(password);

    // Create the admin user
    const result = await pool.query(
      `INSERT INTO admin_users (username, password_hash, roles, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING id, username, roles, created_at`,
      [username, passwordHash, ['admin']]
    );

    await pool.end();

    return NextResponse.json({ 
      success: true,
      message: 'First admin user created successfully',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        roles: result.rows[0].roles,
        created_at: result.rows[0].created_at
      }
    });

  } catch (error) {
    console.error('Create first admin user error:', error);
    return NextResponse.json({ 
      error: 'Failed to create admin user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}