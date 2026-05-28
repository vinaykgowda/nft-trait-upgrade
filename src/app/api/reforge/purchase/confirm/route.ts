import { NextRequest, NextResponse } from 'next/server';
import { ReforgeService } from '@/lib/services/reforge-service';
import { ReforgeError } from '@/types/reforge';
import { z } from 'zod';

const confirmSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  txSignature: z.string().min(64, 'Invalid transaction signature').max(128),
  packId: z.string().uuid('Invalid pack ID format'),
  walletAddress: z.string().min(32).max(44),
  discordId: z.string().min(1, 'Discord ID is required'),
});

/**
 * POST /api/reforge/purchase/confirm
 * Confirm a pack purchase after the user has signed and submitted the transaction.
 * Requires wallet auth (walletAddress in body).
 * Body: { orderId, txSignature, packId, walletAddress, discordId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = confirmSchema.parse(body);

    const reforgeService = new ReforgeService();
    const order = await reforgeService.confirmPurchase(
      parsed.orderId,
      parsed.txSignature,
      parsed.packId,
      parsed.walletAddress,
      parsed.discordId
    );

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('POST /api/reforge/purchase/confirm error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: error.errors[0]?.message || 'Invalid input', retryable: false },
        { status: 400 }
      );
    }

    // Handle ReforgeError-typed errors
    if (error?.error && error?.message) {
      const reforgeError = error as ReforgeError & Error;
      const statusCode = getStatusCodeForError(reforgeError.error);
      return NextResponse.json(
        {
          error: reforgeError.error,
          message: reforgeError.message,
          orderId: reforgeError.orderId,
          retryable: reforgeError.retryable,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', retryable: true },
      { status: 500 }
    );
  }
}

function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'AUTH_REQUIRED':
      return 401;
    case 'TRANSACTION_NOT_CONFIRMED':
      return 400;
    case 'PACK_SOLD_OUT':
      return 409;
    case 'PACK_NOT_FOUND':
      return 404;
    case 'ORDER_NOT_FOUND':
      return 404;
    default:
      return 400;
  }
}
