import { NextRequest, NextResponse } from 'next/server';
import { ReforgeService } from '@/lib/services/reforge-service';
import { ReforgeError } from '@/types/reforge';
import { z } from 'zod';

const executeSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  assetId: z.string().min(32).max(44),
  walletAddress: z.string().min(32).max(44),
});

/**
 * POST /api/reforge/execute
 * Execute a reforge on a purchased pack. Requires wallet auth.
 * Body: { orderId, assetId, walletAddress }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = executeSchema.parse(body);

    // Wallet auth: walletAddress must be provided
    if (!parsed.walletAddress) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Wallet address is required', retryable: false },
        { status: 401 }
      );
    }

    const reforgeService = new ReforgeService();
    const result = await reforgeService.executeReforge(parsed.orderId, parsed.assetId);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('POST /api/reforge/execute error:', error);

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
    case 'ORDER_NOT_FOUND':
      return 404;
    case 'INVALID_ORDER_STATE':
      return 409;
    case 'PACK_NOT_FOUND':
      return 404;
    case 'PROJECT_NOT_FOUND':
      return 404;
    case 'TRAIT_SELECTION_FAILED':
      return 500;
    case 'COMBINATION_EXHAUSTED':
      return 500;
    case 'IMAGE_COMPOSITION_FAILED':
      return 500;
    case 'METADATA_UPDATE_FAILED':
      return 500;
    case 'ENCRYPTION_ERROR':
      return 500;
    default:
      return 400;
  }
}
