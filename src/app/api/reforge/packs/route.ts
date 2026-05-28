import { NextRequest, NextResponse } from 'next/server';
import { PackManager } from '@/lib/services/pack-manager';

/**
 * GET /api/reforge/packs
 * List active packs for a collection (public, no auth required).
 * Query params: collectionId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'collectionId query parameter is required', retryable: false },
        { status: 400 }
      );
    }

    const packManager = new PackManager();
    const packs = await packManager.getPacksByCollection(collectionId, true);

    return NextResponse.json({ packs });
  } catch (error) {
    console.error('GET /api/reforge/packs error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', retryable: true },
      { status: 500 }
    );
  }
}
