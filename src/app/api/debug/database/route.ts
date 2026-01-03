import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      return NextResponse.json({
        error: 'DATABASE_URL not found',
        env: Object.keys(process.env).filter(key => key.includes('DATABASE')),
        allEnvKeys: Object.keys(process.env).length,
        nodeEnv: process.env.NODE_ENV
      });
    }

    // Try to connect to database
    const pool = new Pool({
      connectionString: databaseUrl,
    });

    const result = await pool.query('SELECT NOW() as current_time');
    await pool.end();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      currentTime: result.rows[0].current_time,
      databaseUrlExists: !!databaseUrl,
      databaseUrlLength: databaseUrl.length
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      databaseUrlExists: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      nodeEnv: process.env.NODE_ENV
    }, { status: 500 });
  }
}