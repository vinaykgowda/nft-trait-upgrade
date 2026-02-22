import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Raw SQL — no repository layer, no domain mapping, just raw DB
    const result = await query(`
      SELECT 
        id,
        name,
        seller_fee_basis_points,
        collection_symbol,
        creator_address,
        treasury_wallet
      FROM projects
      ORDER BY created_at ASC
      LIMIT 5
    `);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      commitHash: 'ffeac2a-debug-endpoint',
      projectCount: result.rows.length,
      projects: result.rows,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Failed',
      details: String(error),
    }, { status: 500 });
  }
}
