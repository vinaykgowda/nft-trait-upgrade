import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { TraitPoolRepository } from '@/lib/repositories/trait-pool';
import { query } from '@/lib/database';
import { z } from 'zod';

const toggleSwapPoolSchema = z.object({
  traitId: z.string().uuid('Invalid trait ID'),
  swapPoolOnly: z.boolean(),
  ldzEarning: z.number().min(0, 'LDZ earning must be non-negative').optional(),
});

/**
 * GET /api/admin/reforge/traits
 * List swap pool traits for a collection (query param: collectionId)
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

    const traitPoolRepo = new TraitPoolRepository();
    const rows = await traitPoolRepo.findByCollection(collectionId);
    const traits = rows.map((row) => traitPoolRepo.toDomain(row));

    return NextResponse.json({ traits });
  } catch (error) {
    console.error('Admin GET reforge traits error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/reforge/traits
 * Toggle swap-pool-only flag on a trait and optionally set LDZ earning
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = toggleSwapPoolSchema.parse(body);

    // Verify trait exists
    const traitResult = await query('SELECT id, name, swap_pool_only, ldz_earning FROM traits WHERE id = $1', [parsed.traitId]);
    if (traitResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'TRAIT_NOT_FOUND', message: `Trait with id ${parsed.traitId} not found`, retryable: false },
        { status: 404 }
      );
    }

    // Update swap_pool_only flag and optionally ldz_earning
    let updateQuery: string;
    let updateParams: any[];

    if (parsed.ldzEarning !== undefined) {
      updateQuery = `
        UPDATE traits 
        SET swap_pool_only = $2, ldz_earning = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, swap_pool_only, ldz_earning
      `;
      updateParams = [parsed.traitId, parsed.swapPoolOnly, parsed.ldzEarning];
    } else {
      updateQuery = `
        UPDATE traits 
        SET swap_pool_only = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, swap_pool_only, ldz_earning
      `;
      updateParams = [parsed.traitId, parsed.swapPoolOnly];
    }

    const result = await query(updateQuery, updateParams);
    const updatedTrait = result.rows[0];

    return NextResponse.json({
      trait: {
        id: updatedTrait.id,
        name: updatedTrait.name,
        swapPoolOnly: updatedTrait.swap_pool_only,
        ldzEarning: parseFloat(updatedTrait.ldz_earning || '0'),
      },
    });
  } catch (error: any) {
    console.error('Admin PUT reforge traits error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: error.errors[0]?.message || 'Invalid input', retryable: false },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
