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

    console.log('Starting database repair...');

    // Check current rarity tiers
    const currentRarities = await query('SELECT id, name FROM rarity_tiers ORDER BY display_order');
    console.log('Current rarity tiers:', currentRarities.rows);

    // Check traits with missing rarity relationships
    const orphanedTraits = await query(`
      SELECT t.id, t.name, t.rarity_tier_id, rt.name as rarity_name
      FROM traits t
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
      WHERE rt.id IS NULL
    `);
    console.log('Traits with missing rarity relationships:', orphanedTraits.rows);

    // Fix: Update rarity tiers to use standard IDs and names
    await query('DELETE FROM rarity_tiers');
    
    const rarityInsertResult = await query(`
      INSERT INTO rarity_tiers (id, name, weight, display_order, created_at) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'Common', 50, 1, NOW()),
        ('550e8400-e29b-41d4-a716-446655440002', 'Uncommon', 30, 2, NOW()),
        ('550e8400-e29b-41d4-a716-446655440003', 'Rare', 15, 3, NOW()),
        ('550e8400-e29b-41d4-a716-446655440004', 'Legendary', 4, 4, NOW()),
        ('550e8400-e29b-41d4-a716-446655440005', 'Mythic', 1, 5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        weight = EXCLUDED.weight,
        display_order = EXCLUDED.display_order
    `);
    console.log('Rarity tiers updated:', rarityInsertResult.rowCount);

    // Fix: Update all traits to use Common rarity (can be changed individually later)
    const traitUpdateResult = await query(`
      UPDATE traits 
      SET rarity_tier_id = '550e8400-e29b-41d4-a716-446655440001'
      WHERE rarity_tier_id IS NULL 
         OR rarity_tier_id NOT IN (
           '550e8400-e29b-41d4-a716-446655440001',
           '550e8400-e29b-41d4-a716-446655440002', 
           '550e8400-e29b-41d4-a716-446655440003',
           '550e8400-e29b-41d4-a716-446655440004',
           '550e8400-e29b-41d4-a716-446655440005'
         )
    `);
    console.log('Traits updated to use valid rarity IDs:', traitUpdateResult.rowCount);

    // Check SOL token exists
    const solToken = await query('SELECT id FROM tokens WHERE symbol = $1', ['SOL']);
    if (solToken.rows.length === 0) {
      await query(`INSERT INTO tokens (symbol, mint_address, decimals, enabled) VALUES ('SOL', NULL, 9, TRUE)`);
      console.log('SOL token created');
    }

    // Fix traits with missing token relationships
    const tokenUpdateResult = await query(`
      UPDATE traits 
      SET price_token_id = (SELECT id FROM tokens WHERE symbol = 'SOL' LIMIT 1)
      WHERE price_token_id IS NULL 
         OR price_token_id NOT IN (SELECT id FROM tokens)
    `);
    console.log('Traits updated to use valid token IDs:', tokenUpdateResult.rowCount);

    // Verify the fixes
    const verifyRarities = await query('SELECT id, name FROM rarity_tiers ORDER BY display_order');
    const verifyTraits = await query(`
      SELECT COUNT(*) as total_traits,
             COUNT(CASE WHEN rt.name IS NOT NULL THEN 1 END) as traits_with_rarity,
             COUNT(CASE WHEN tok.symbol IS NOT NULL THEN 1 END) as traits_with_token
      FROM traits t
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
      LEFT JOIN tokens tok ON t.price_token_id = tok.id
    `);

    return NextResponse.json({
      success: true,
      message: 'Database repair completed successfully',
      results: {
        raritiesFixed: rarityInsertResult.rowCount,
        traitsUpdated: traitUpdateResult.rowCount,
        tokensUpdated: tokenUpdateResult.rowCount,
        verification: {
          rarityTiers: verifyRarities.rows,
          traitStats: verifyTraits.rows[0]
        }
      }
    });

  } catch (error) {
    console.error('Database repair error:', error);
    return NextResponse.json(
      { error: 'Failed to repair database' },
      { status: 500 }
    );
  }
}