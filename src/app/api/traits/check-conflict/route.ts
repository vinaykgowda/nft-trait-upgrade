import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

/**
 * POST /api/traits/check-conflict
 * Check if a trait conflicts with any of the NFT's current traits
 * Supports two modes:
 * 1. { traitId, nftAttributes: [{trait_type, value}] } - match by name
 * 2. { traitId, nftTraitIds: [uuid] } - match by trait ID (legacy)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { traitId, nftAttributes, nftTraitIds } = body;

    if (!traitId) {
      return NextResponse.json({ error: 'traitId is required' }, { status: 400 });
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

    // Mode 1: match by nftAttributes (trait_type + value strings)
    if (Array.isArray(nftAttributes) && nftAttributes.length > 0) {
      for (const conflict of conflictsResult.rows) {
        for (const attr of nftAttributes) {
          // Skip if value is not a string (e.g. Rarity Rank = 942)
          if (!attr.trait_type || !attr.value || typeof attr.value !== 'string') continue;

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
    }

    // Mode 2: match by nftTraitIds (legacy)
    if (Array.isArray(nftTraitIds) && nftTraitIds.length > 0) {
      const conflictIds = conflictsResult.rows.map((r: any) => r.conflicts_with_trait_id);
      const found = nftTraitIds.find((id: string) => conflictIds.includes(id));
      if (found) {
        const conflict = conflictsResult.rows.find((r: any) => r.conflicts_with_trait_id === found);
        return NextResponse.json({
          hasConflict: true,
          conflictingTrait: {
            id: found,
            name: conflict?.conflict_trait_name,
            slotName: conflict?.conflict_slot_name
          }
        });
      }
      return NextResponse.json({ hasConflict: false });
    }

    return NextResponse.json({ hasConflict: false });

  } catch (error) {
    console.error('Check conflict error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
