import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check what's in rarity_tiers table
    const rarityTiers = await query('SELECT * FROM rarity_tiers ORDER BY display_order');
    
    // Check what's in traits table with their rarity relationships
    const traitsWithRarity = await query(`
      SELECT 
        t.id, 
        t.name, 
        t.rarity_tier_id,
        rt.name as rarity_name,
        rt.id as actual_rarity_id
      FROM traits t
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      rarityTiers: rarityTiers.rows,
      traits: traitsWithRarity.rows,
      debug: {
        totalRarityTiers: rarityTiers.rows.length,
        totalTraits: traitsWithRarity.rows.length,
        traitsWithNullRarity: traitsWithRarity.rows.filter((t: any) => !t.rarity_name).length
      }
    });

  } catch (error) {
    console.error('Debug rarity error:', error);
    return NextResponse.json({ error: 'Failed to debug' }, { status: 500 });
  }
}