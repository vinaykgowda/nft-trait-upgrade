import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow in development or with special header
    const authHeader = request.headers.get('x-migration-key');
    if (process.env.NODE_ENV === 'production' && authHeader !== process.env.MIGRATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const client = await pool.connect();

    try {
      console.log('🔧 Starting token constraint migration...');

      // Drop the existing foreign key constraint
      await client.query(`
        ALTER TABLE traits DROP CONSTRAINT IF EXISTS traits_price_token_id_fkey
      `);
      console.log('✅ Dropped foreign key constraint');

      // Add index for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_traits_price_token_id ON traits(price_token_id)
      `);
      console.log('✅ Added performance index');

      // Add comment to document the change
      await client.query(`
        COMMENT ON COLUMN traits.price_token_id IS 'References either tokens.id or project_tokens.id - validated in application layer'
      `);
      console.log('✅ Added documentation comment');

      console.log('🎉 Token constraint migration completed successfully');

      return NextResponse.json({ 
        success: true, 
        message: 'Token constraint migration completed successfully',
        details: [
          'Removed foreign key constraint from traits.price_token_id',
          'Added performance index',
          'Traits can now reference both main tokens and project tokens'
        ]
      });

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error) {
    console.error('Token migration error:', error);
    return NextResponse.json({ 
      error: 'Token migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}