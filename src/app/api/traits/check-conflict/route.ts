import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

/**
 * POST /api/traits/check-conflict
 * Check if a trait conflicts with any of the NFT's current traits
 * Body: { traitId: string, nftAttributes: Array<{trait_type: string, value: string}> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { traitId, nftAttributes } = body;

    if (!traitId || !nftAttributes || !Array.isArray(nftAttributes)) {
      return NextResponse.json(
        { error: 'Missing required fields: traitId and nftAttributes' },
        { status: 400 }
      );
    }

    // Get conflicts for the selected trait
    const conflictsResult = await query(
      `SELECT 
        tc.conflicts_with_trait_id,
        t.name as conflict_trait_name,
        t.slot_id as conflict_slot_id,
        ts.name as conflict_slot_name
      FROM trait_conflicts tc
      JOIN traits t ON tc.conflicts_with_trait_id = t.id
      JOIN trait_slots ts ON t.slot_id = ts.id
      WHERE tc.trait_id = $1`,
      [traitId]
    );

    if (conflictsResult.rows.length === 0) {
      return NextResponse.json({ hasConflict: false });
    }

    // Check if any NFT attribute matches a conflicting trait
    for (const conflict of conflictsResult.rows) {
      for (const attr of nftAttributes) {
        if (!attr.trait_type || !attr.value) continue;
        
        // Match by slot name and trait name (case-insensitive)
        const slotMatch = conflict.conflict_slot_name.toLowerCase() === attr.trait_type.toLowerCase();
        const nameMatch = conflict.conflict_trait_name.toLowerCase() === attr.value.toLowerCase();
        
        if (slotMatch && nameMatch) {
          return NextResponse.json({
            hasConflict: true,
            conflictingTrait: {
              name: conflict.conflict_trait_name,
              slotName: conflict.conflict_slot_name
            }
          });
        }
      }
    }

    return NextResponse.json({ hasConflict: false });

  } catch (error) {
    console.error('Check conflict error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
