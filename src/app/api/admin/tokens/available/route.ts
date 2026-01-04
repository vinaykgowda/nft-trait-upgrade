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

    // PRIMARY: Get project tokens (this is where your actual tokens are)
    const projectTokensResult = await query(`
      SELECT id, token_address, token_name, token_symbol, decimals, enabled
      FROM project_tokens 
      WHERE enabled = TRUE
      ORDER BY token_symbol
    `);

    // SECONDARY: Get main tokens as additional options
    const mainTokensResult = await query(`
      SELECT id, symbol, mint_address, decimals, enabled
      FROM tokens 
      WHERE enabled = TRUE
      ORDER BY symbol
    `);

    console.log('🔍 Token fetch results:', {
      projectTokens: projectTokensResult.rows.length,
      mainTokens: mainTokensResult.rows.length,
      projectTokensData: projectTokensResult.rows,
      mainTokensData: mainTokensResult.rows
    });

    const tokens: any[] = [];

    // Add project tokens FIRST (these are your primary tokens)
    projectTokensResult.rows.forEach((row: any) => {
      tokens.push({
        id: row.id,
        projectId: '',
        tokenAddress: row.token_address,
        tokenName: row.token_name,
        tokenSymbol: row.token_symbol,
        decimals: row.decimals,
        enabled: row.enabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // Add main tokens as additional options (avoid duplicates)
    mainTokensResult.rows.forEach((row: any) => {
      // Avoid duplicates by checking if token symbol already exists
      const existingToken = tokens.find(t => t.tokenSymbol === row.symbol);
      if (!existingToken) {
        tokens.push({
          id: row.id,
          projectId: '',
          tokenAddress: row.mint_address || 'So11111111111111111111111111111111111111112', // SOL address for null mint_address
          tokenName: row.symbol === 'SOL' ? 'Solana' : row.symbol,
          tokenSymbol: row.symbol,
          decimals: row.decimals,
          enabled: row.enabled,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    console.log('🎯 Final tokens array:', tokens.map(t => ({ 
      id: t.id, 
      symbol: t.tokenSymbol, 
      name: t.tokenName,
      address: t.tokenAddress 
    })));

    return NextResponse.json({
      success: true,
      tokens
    });

  } catch (error) {
    console.error('Get available tokens API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}