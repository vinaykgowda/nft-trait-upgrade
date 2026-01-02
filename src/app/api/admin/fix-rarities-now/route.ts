import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { query } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    console.log('🔥 NUCLEAR FIX: Fixing rarities NOW');

    // Step 1: Delete ALL existing rarity tiers
    await query('DELETE FROM rarity_tiers');
    console.log('✅ Deleted all existing rarity tiers');

    // Step 2: Insert the correct rarity tiers with EXACT IDs
    await query(`
      INSERT INTO rarity_tiers (id, name, weight, display_order, created_at) VALUES
      ('550e8400-e29b-41d4-a716-446655440001', 'Common', 50, 1, NOW()),
      ('550e8400-e29b-41d4-a716-446655440002', 'Uncommon', 30, 2, NOW()),
      ('550e8400-e29b-41d4-a716-446655440003', 'Rare', 15, 3, NOW()),
      ('550e8400-e29b-41d4-a716-446655440004', 'Legendary', 4, 4, NOW()),
      ('550e8400-e29b-41d4-a716-446655440005', 'Mythic', 1, 5, NOW())
    `);
    console.log('✅ Inserted correct rarity tiers');

    // Step 3: Update ALL traits to use Common rarity (we'll fix individual ones after)
    const updateResult = await query(`
      UPDATE traits 
      SET rarity_tier_id = '550e8400-e29b-41d4-a716-446655440001'
    `);
    console.log(`✅ Updated ${updateResult.rowCount} traits to Common rarity`);

    // Step 4: Verify the fix worked
    const verifyTraits = await query(`
      SELECT t.id, t.name, rt.name as rarity_name
      FROM traits t
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
      LIMIT 5
    `);
    console.log('✅ Verification - first 5 traits:', verifyTraits.rows);

    // Step 5: Count traits with proper rarities
    const countResult = await query(`
      SELECT 
        COUNT(*) as total_traits,
        COUNT(rt.name) as traits_with_rarity
      FROM traits t
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
    `);
    
    const { total_traits, traits_with_rarity } = countResult.rows[0];
    console.log(`✅ Result: ${traits_with_rarity}/${total_traits} traits now have proper rarities`);

    return NextResponse.json({
      success: true,
      message: 'RARITIES FIXED!',
      results: {
        totalTraits: parseInt(total_traits),
        traitsWithRarity: parseInt(traits_with_rarity),
        allFixed: parseInt(total_traits) === parseInt(traits_with_rarity)
      }
    });

  } catch (error) {
    console.error('🔥 NUCLEAR FIX ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to fix rarities' },
      { status: 500 }
    );
  }
}