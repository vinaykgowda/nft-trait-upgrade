import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { PackManager, CreatePackInput } from '@/lib/services/pack-manager';
import { z } from 'zod';

const createPackSchema = z.object({
  collectionId: z.string().min(1, 'Collection ID is required'),
  tierName: z.enum(['silver', 'gold', 'diamond'], {
    errorMap: () => ({ message: 'Tier must be silver, gold, or diamond' }),
  }),
  solPrice: z.number().positive('SOL price must be positive'),
  minLdzEarning: z.number().min(0, 'Min LDZ earning must be non-negative'),
  maxLdzEarning: z.number().min(0, 'Max LDZ earning must be non-negative'),
  totalInventory: z.number().int().positive('Total inventory must be a positive integer'),
});

/**
 * GET /api/admin/reforge/packs
 * List all packs for a collection (query param: collectionId)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'collectionId query parameter is required', retryable: false },
        { status: 400 }
      );
    }

    const packManager = new PackManager();
    const packs = await packManager.getPacksByCollection(collectionId);

    return NextResponse.json({ packs });
  } catch (error) {
    console.error('Admin GET reforge packs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/reforge/packs
 * Create a new reforge pack
 */
export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPackSchema.parse(body);

    const packManager = new PackManager();
    const pack = await packManager.createPack(parsed as CreatePackInput);

    return NextResponse.json({ pack }, { status: 201 });
  } catch (error: any) {
    console.error('Admin POST reforge packs error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'INVALID_PACK_CONFIG', message: error.errors[0]?.message || 'Invalid input', retryable: false },
        { status: 400 }
      );
    }

    if (error?.error === 'INVALID_PACK_CONFIG') {
      return NextResponse.json(
        { error: error.error, message: error.message, retryable: false },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
