import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting create simple user...');
    
    const { username, password } = await request.json();
    console.log('Received username:', username);

    if (!username || !password) {
      return NextResponse.json({ 
        error: 'Username and password are required' 
      }, { status: 400 });
    }

    console.log('Connecting to database...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Check if any admin users already exist
    console.log('Checking existing admin users...');
    const existingAdmins = await pool.query('SELECT COUNT(*) FROM admin_users');
    const adminCount = parseInt(existingAdmins.rows[0].count);
    console.log('Existing admin count:', adminCount);

    if (adminCount > 0) {
      await pool.end();
      return NextResponse.json({ 
        error: 'Admin users already exist' 
      }, { status: 403 });
    }

    // Hash the password
    console.log('Hashing password...');
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    console.log('Password hashed successfully');

    // Create the admin user
    console.log('Creating admin user...');
    const result = await pool.query(
      `INSERT INTO admin_users (username, password_hash, roles, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING id, username, roles, created_at`,
      [username, passwordHash, ['admin']]
    );
    console.log('User created:', result.rows[0]);

    await pool.end();

    return NextResponse.json({ 
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        roles: result.rows[0].roles,
        created_at: result.rows[0].created_at
      }
    });

  } catch (error) {
    console.error('Create simple user error:', error);
    return NextResponse.json({ 
      error: 'Failed to create admin user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}