import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check database state
    const rarityCount = await query('SELECT COUNT(*) as count FROM rarity_tiers');
    const traitCount = await query('SELECT COUNT(*) as count FROM traits');
    const slotCount = await query('SELECT COUNT(*) as count FROM trait_slots');
    const tokenCount = await query('SELECT COUNT(*) as count FROM tokens');
    
    // Get sample data
    const rarities = await query('SELECT id, name FROM rarity_tiers ORDER BY display_order LIMIT 5');
    const traits = await query(`
      SELECT t.id, t.name, t.rarity_tier_id, rt.name as rarity_name 
      FROM traits t 
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id 
      ORDER BY t.created_at DESC 
      LIMIT 5
    `);
    const slots = await query('SELECT id, name FROM trait_slots ORDER BY layer_order LIMIT 5');
    const tokens = await query('SELECT id, symbol FROM tokens LIMIT 5');

    return NextResponse.json({
      counts: {
        rarities: parseInt(rarityCount.rows[0].count),
        traits: parseInt(traitCount.rows[0].count),
        slots: parseInt(slotCount.rows[0].count),
        tokens: parseInt(tokenCount.rows[0].count)
      },
      samples: {
        rarities: rarities.rows,
        traits: traits.rows,
        slots: slots.rows,
        tokens: tokens.rows
      },
      status: {
        databaseReady: true,
        hasRarities: parseInt(rarityCount.rows[0].count) > 0,
        hasTraits: parseInt(traitCount.rows[0].count) > 0,
        hasSlots: parseInt(slotCount.rows[0].count) > 0,
        hasTokens: parseInt(tokenCount.rows[0].count) > 0
      }
    });

  } catch (error) {
    console.error('Debug upload error:', error);
    return NextResponse.json({ error: 'Failed to debug' }, { status: 500 });
  }
}