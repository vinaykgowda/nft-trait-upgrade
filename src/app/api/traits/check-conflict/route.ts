import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/database';
import { TraitConflictsRepository } from '@/lib/repositories/trait-conflicts';

/**
 * POST /api/traits/check-conflict
 * Check if a trait conflicts with any of the NFT's current traits
 * Body: { traitId: string, nftTraitIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { traitId, nftTraitIds } = body;

    if (!traitId || !Array.isArray(nftTraitIds)) {
      return NextResponse.json(
        { error: 'traitId and nftTraitIds array are required' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const repo = new TraitConflictsRepository(pool);
    const result = await repo.checkConflictWithNFT(traitId, nftTraitIds);

    if (result.hasConflict) {
      // Get the conflicting trait details
      const conflictingTrait = await pool.query(
        `SELECT t.name, ts.name as slot_name
         FROM traits t
         JOIN trait_slots ts ON t.slot_id = ts.id
         WHERE t.id = $1`,
        [result.conflictingTraitId]
      );

      const traitDetails = conflictingTrait.rows[0];

      return NextResponse.json({
        hasConflict: true,
        conflictingTrait: {
          id: result.conflictingTraitId,
          name: traitDetails?.name,
          slotName: traitDetails?.slot_name
        }
      });
    }

    return NextResponse.json({ hasConflict: false });
  } catch (error) {
    console.error('Error checking trait conflict:', error);
    return NextResponse.json(
      { error: 'Failed to check conflict' },
      { status: 500 }
    );
  }
}
