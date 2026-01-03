import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

export async function GET() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Check if admin_users table exists and count users
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      await pool.end();
      return NextResponse.json({
        error: 'admin_users table does not exist',
        suggestion: 'Run database migrations first'
      });
    }

    const userCount = await pool.query('SELECT COUNT(*) FROM admin_users');
    const users = await pool.query('SELECT id, username, roles, created_at FROM admin_users');

    await pool.end();

    return NextResponse.json({
      success: true,
      adminUsersTableExists: true,
      totalUsers: parseInt(userCount.rows[0].count),
      users: users.rows
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check admin users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Create a default admin user
    const username = 'admin';
    const password = 'admin123'; // Change this in production!
    const passwordHash = await argon2.hash(password);

    const result = await pool.query(`
      INSERT INTO admin_users (username, password_hash, roles, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username, roles
    `, [username, passwordHash, ['admin']]);

    await pool.end();

    if (result.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Admin user created successfully',
        user: result.rows[0],
        credentials: {
          username: 'admin',
          password: 'admin123'
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Admin user already exists',
        credentials: {
          username: 'admin',
          password: 'admin123'
        }
      });
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to create admin user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}