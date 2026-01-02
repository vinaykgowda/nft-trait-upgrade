#!/usr/bin/env node

const { Pool } = require('pg');

async function addNFTTraits() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🎨 Adding NFT-specific traits for preview system...');

    // Get slot IDs
    const slotsResult = await pool.query(`
      SELECT id, name FROM trait_slots WHERE name IN ('Fur', 'Clothes', 'Eyes', 'Mouth')
    `);
    
    const slots = {};
    slotsResult.rows.forEach(row => {
      slots[row.name] = row.id;
    });

    // Get SOL token ID and common rarity tier
    const tokenResult = await pool.query(`SELECT id FROM tokens WHERE symbol = 'SOL'`);
    const rarityResult = await pool.query(`SELECT id FROM rarity_tiers WHERE name = 'Common'`);
    
    const solTokenId = tokenResult.rows[0]?.id;
    const commonRarityId = rarityResult.rows[0]?.id;

    if (!solTokenId || !commonRarityId) {
      throw new Error('Missing SOL token or Common rarity tier');
    }

    // Add the specific traits that match NFT attributes
    const traitsToAdd = [
      { slot: 'Fur', name: 'Magma', imageUrl: '/uploads/traits/fur/magma.png' },
      { slot: 'Clothes', name: 'Hoodie', imageUrl: '/uploads/traits/clothes/hoodie.png' },
      { slot: 'Eyes', name: 'Supernova', imageUrl: '/uploads/traits/eyes/supernova.png' },
      { slot: 'Mouth', name: 'Not Amused', imageUrl: '/uploads/traits/mouth/not-amused.png' }
    ];

    for (const trait of traitsToAdd) {
      if (!slots[trait.slot]) {
        console.log(`⚠️ Slot ${trait.slot} not found, skipping ${trait.name}`);
        continue;
      }

      const result = await pool.query(`
        INSERT INTO traits (slot_id, name, image_layer_url, rarity_tier_id, total_supply, remaining_supply, price_amount, price_token_id, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [
        slots[trait.slot],
        trait.name,
        trait.imageUrl,
        commonRarityId,
        100,
        100,
        BigInt(500000000), // 0.5 SOL in lamports
        solTokenId,
        true
      ]);

      if (result.rows.length > 0) {
        console.log(`✅ Added trait: ${trait.slot} - ${trait.name}`);
      } else {
        console.log(`ℹ️ Trait already exists: ${trait.slot} - ${trait.name}`);
      }
    }

    console.log('✅ NFT traits added successfully!');

  } catch (error) {
    console.error('❌ Error adding NFT traits:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

addNFTTraits();