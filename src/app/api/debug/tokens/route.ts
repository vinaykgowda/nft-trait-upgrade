import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Check main tokens table
    const mainTokensResult = await query(`
      SELECT id, symbol, mint_address, decimals, enabled, created_at
      FROM tokens 
      ORDER BY symbol
    `);

    // Check project tokens table
    const projectTokensResult = await query(`
      SELECT id, token_address, token_name, token_symbol, decimals, enabled, created_at
      FROM project_tokens 
      ORDER BY token_symbol
    `);

    return NextResponse.json({
      success: true,
      debug: {
        mainTokens: {
          count: mainTokensResult.rows.length,
          tokens: mainTokensResult.rows
        },
        projectTokens: {
          count: projectTokensResult.rows.length,
          tokens: projectTokensResult.rows
        }
      }
    });

  } catch (error) {
    console.error('Debug tokens API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}