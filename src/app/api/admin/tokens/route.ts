import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get all available tokens from both main tokens table and project tokens
    const tokensResult = await query(`
      SELECT id, symbol as token_symbol, mint_address as token_address, decimals, enabled, symbol as token_name, 'main' as source
      FROM tokens
      WHERE enabled = TRUE
      UNION
      SELECT id, token_symbol, token_address, decimals, enabled, token_name, 'project' as source
      FROM project_tokens
      WHERE enabled = TRUE
      ORDER BY token_symbol
    `);

    // Deduplicate tokens by symbol, preferring main tokens table
    const tokenMap = new Map();
    tokensResult.rows.forEach((row: any) => {
      const key = row.token_symbol;
      if (!tokenMap.has(key) || row.source === 'main') {
        tokenMap.set(key, {
          id: row.id,
          tokenAddress: row.token_address || 'So11111111111111111111111111111111111111112', // Use SOL address for native SOL
          tokenName: row.token_name || row.token_symbol,
          tokenSymbol: row.token_symbol,
          decimals: row.decimals,
          enabled: row.enabled
        });
      }
    });

    const tokens = Array.from(tokenMap.values());

    return NextResponse.json({
      success: true,
      tokens
    });

  } catch (error) {
    console.error('Get tokens API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}