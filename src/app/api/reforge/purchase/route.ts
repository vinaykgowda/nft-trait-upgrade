import { NextRequest, NextResponse } from 'next/server';
import { ReforgeService } from '@/lib/services/reforge-service';
import { ReforgeError } from '@/types/reforge';
import { z } from 'zod';

const purchaseSchema = z.object({
  packId: z.string().uuid('Invalid pack ID format'),
  walletAddress: z.string().min(32).max(44),
  discordId: z.string().min(1, 'Discord ID is required'),
});

/**
 * POST /api/reforge/purchase
 * Initiate a pack purchase. Requires wallet + Discord auth.
 * Body: { packId, walletAddress, discordId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = purchaseSchema.parse(body);

    const reforgeService = new ReforgeService();
    const result = await reforgeService.initiatePurchase(
      parsed.packId,
      parsed.walletAddress,
      parsed.discordId
    );

    // Serialize the transaction for client-side signing
    const serializedTransaction = Buffer.from(
      result.transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
    ).toString('base64');

    return NextResponse.json({
      transaction: serializedTransaction,
      orderId: result.orderId,
    });
  } catch (error: any) {
    console.error('POST /api/reforge/purchase error:', error);

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
    case 'PACK_SOLD_OUT':
      return 409;
    case 'PACK_DISABLED':
      return 403;
    case 'PACK_NOT_FOUND':
      return 404;
    case 'CONFIGURATION_ERROR':
      return 500;
    default:
      return 400;
  }
}
