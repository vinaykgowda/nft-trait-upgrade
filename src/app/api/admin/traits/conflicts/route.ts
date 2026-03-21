import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/database';
import { TraitConflictsRepository } from '@/lib/repositories/trait-conflicts';

/**
 * GET /api/admin/traits/conflicts?traitId=xxx
 * Get all conflicts for a specific trait
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const traitId = searchParams.get('traitId');

    if (!traitId) {
      return NextResponse.json(
        { error: 'traitId is required' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const repo = new TraitConflictsRepository(pool);
    const conflicts = await repo.getConflictsForTrait(traitId);

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error('Error fetching trait conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conflicts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/traits/conflicts
 * Set conflicts for a trait (replaces existing)
 * Body: { traitId: string, conflictingTraitIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { traitId, conflictingTraitIds } = body;

    if (!traitId || !Array.isArray(conflictingTraitIds)) {
      return NextResponse.json(
        { error: 'traitId and conflictingTraitIds array are required' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const repo = new TraitConflictsRepository(pool);
    await repo.setConflictsForTrait(traitId, conflictingTraitIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting trait conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to set conflicts' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/traits/conflicts?traitId=xxx&conflictId=yyy
 * Remove a specific conflict relationship
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const traitId = searchParams.get('traitId');
    const conflictId = searchParams.get('conflictId');

    if (!traitId || !conflictId) {
      return NextResponse.json(
        { error: 'traitId and conflictId are required' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const repo = new TraitConflictsRepository(pool);
    await repo.removeConflict(traitId, conflictId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing trait conflict:', error);
    return NextResponse.json(
      { error: 'Failed to remove conflict' },
      { status: 500 }
    );
  }
}
