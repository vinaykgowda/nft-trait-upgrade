import { NextRequest, NextResponse } from 'next/server';
import { HeliusService } from '@/lib/services/helius';
import { requireAdminAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tokenAddress } = await request.json();

    if (!tokenAddress) {
      return NextResponse.json({ error: 'Token address is required' }, { status: 400 });
    }

    // Validate token address format
    if (!HeliusService.isValidTokenAddress(tokenAddress)) {
      return NextResponse.json({ error: 'Invalid token address format' }, { status: 400 });
    }

    // Check if it's SOL (native token)
    if (tokenAddress === 'So11111111111111111111111111111111111111112' || tokenAddress.toLowerCase() === 'sol') {
      return NextResponse.json({
        success: true,
        tokenInfo: {
          address: 'So11111111111111111111111111111111111111112',
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      });
    }

    // Fetch token information
    const tokenInfo = await HeliusService.getTokenInfo(tokenAddress);

    if (!tokenInfo) {
      return NextResponse.json({ error: 'Token not found or invalid' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      tokenInfo
    });

  } catch (error) {
    console.error('Token info fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token information' },
      { status: 500 }
    );
  }
}