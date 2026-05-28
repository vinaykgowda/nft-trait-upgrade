import { NextRequest, NextResponse } from 'next/server';
import { ReforgeService } from '@/lib/services/reforge-service';
import { ReforgeError } from '@/types/reforge';

/**
 * GET /api/reforge/orders
 * Get user's reforge orders. Requires wallet auth.
 * Query params: walletAddress (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'walletAddress query parameter is required', retryable: false },
        { status: 401 }
      );
    }

    if (walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invalid wallet address format', retryable: false },
        { status: 400 }
      );
    }

    const reforgeService = new ReforgeService();
    const orders = await reforgeService.getOrdersByWallet(walletAddress);

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('GET /api/reforge/orders error:', error);

    // Handle ReforgeError-typed errors
    if (error?.error && error?.message) {
      const reforgeError = error as ReforgeError & Error;
      return NextResponse.json(
        {
          error: reforgeError.error,
          message: reforgeError.message,
          orderId: reforgeError.orderId,
          retryable: reforgeError.retryable,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', retryable: true },
      { status: 500 }
    );
  }
}
