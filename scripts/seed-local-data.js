#!/usr/bin/env node

const { Pool } = require('pg');

async function seedLocalData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🌱 Seeding local development data...');

    // Create a sample project
    const projectResult = await pool.query(`
      INSERT INTO projects (name, description, treasury_wallet, collection_ids)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      'Sample NFT Project',
      'A sample project for local development and testing',
      '11111111111111111111111111111112', // Burn address for testing
      ['SampleCollection1111111111111111111111111'] // Sample collection ID
    ]);

    // Create trait slots
    const slotResults = await pool.query(`
      INSERT INTO trait_slots (name, layer_order, rules_json)
      VALUES 
        ('Background', 1, '{}'),
        ('Body', 2, '{}'),
        ('Eyes', 3, '{}'),
        ('Mouth', 4, '{}'),
        ('Hat', 5, '{}')
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `);

    // Get SOL token ID
    const tokenResult = await pool.query(`
      SELECT id FROM tokens WHERE symbol = 'SOL'
    `);
    const solTokenId = tokenResult.rows[0]?.id;

    // Get rarity tier IDs
    const rarityResult = await pool.query(`
      SELECT id, name FROM rarity_tiers ORDER BY display_order
    `);
    const rarities = rarityResult.rows;

    // Create sample traits for each slot
    for (const slot of slotResults.rows) {
      for (let i = 1; i <= 3; i++) {
        const rarity = rarities[i % rarities.length];
        await pool.query(`
          INSERT INTO traits (slot_id, name, image_layer_url, rarity_tier_id, total_supply, remaining_supply, price_amount, price_token_id, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
        `, [
          slot.id,
          `${slot.name} ${i}`,
          `https://via.placeholder.com/300x300.png?text=${slot.name}+${i}`,
          rarity.id,
          100,
          100,
          BigInt(1000000000), // 1 SOL in lamports
          solTokenId,
          true
        ]);
      }
    }

    // Create a sample admin user (password: "admin123")
    const argon2 = require('argon2');
    const hashedPassword = await argon2.hash('admin123');
    
    await pool.query(`
      INSERT INTO admin_users (username, password_hash, roles)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO NOTHING
    `, [
      'admin',
      hashedPassword,
      ['admin']
    ]);

    console.log('✅ Local development data seeded successfully!');
    console.log('');
    console.log('📋 Sample data created:');
    console.log('   - Project: Sample NFT Project');
    console.log('   - Trait slots: Background, Body, Eyes, Mouth, Hat');
    console.log('   - Sample traits for each slot');
    console.log('   - Admin user: admin / admin123');
    console.log('');
    console.log('🚀 You can now start the development server with: npm run dev');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.log('Please create a .env.local file with your database connection string');
  process.exit(1);
}

seedLocalData();