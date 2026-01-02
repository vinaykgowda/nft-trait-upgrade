#!/usr/bin/env node

/**
 * Fix script to correct trait price_token_id values
 * The issue: price_token_id is set to slot_id instead of actual token_id
 */

const { Client } = require('pg');

async function fixTraitTokenIds() {
  // Read DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/nft_trait_marketplace_dev';
  
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // First, let's see the current state
    console.log('\n🔍 Checking current trait token assignments...');
    
    const checkQuery = `
      SELECT 
        t.id,
        t.name,
        t.price_amount,
        t.price_token_id,
        t.slot_id,
        tok.symbol as current_token_symbol,
        CASE 
          WHEN t.price_token_id = t.slot_id THEN 'WRONG - using slot_id as token_id'
          ELSE 'OK'
        END as status
      FROM traits t
      LEFT JOIN tokens tok ON t.price_token_id = tok.id
      ORDER BY t.name;
    `;

    const checkResult = await client.query(checkQuery);
    
    console.log('\nCurrent trait token assignments:');
    checkResult.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.price_amount} ${row.current_token_symbol || 'NULL'} (${row.status})`);
    });

    // Find available tokens
    console.log('\n🪙 Available tokens:');
    const tokensResult = await client.query('SELECT id, symbol, mint_address FROM tokens ORDER BY symbol');
    tokensResult.rows.forEach(token => {
      console.log(`- ${token.symbol}: ${token.id} (mint: ${token.mint_address || 'SOL'})`);
    });

    // Find traits that need fixing (where price_token_id = slot_id)
    const brokenTraitsQuery = `
      SELECT id, name, price_amount, price_token_id, slot_id
      FROM traits 
      WHERE price_token_id = slot_id;
    `;
    
    const brokenTraits = await client.query(brokenTraitsQuery);
    
    if (brokenTraits.rows.length === 0) {
      console.log('\n✅ No traits found with incorrect token IDs!');
      return;
    }

    console.log(`\n🚨 Found ${brokenTraits.rows.length} traits with incorrect token IDs:`);
    brokenTraits.rows.forEach(trait => {
      console.log(`- ${trait.name}: price_token_id = slot_id = ${trait.price_token_id}`);
    });

    // Get the LDZ token ID (assuming these should be LDZ tokens)
    const ldzTokenResult = await client.query("SELECT id FROM tokens WHERE symbol = 'LDZ' LIMIT 1");
    
    if (ldzTokenResult.rows.length === 0) {
      console.log('\n❌ No LDZ token found in database!');
      console.log('Please add LDZ token first:');
      console.log("INSERT INTO tokens (symbol, mint_address, decimals, enabled) VALUES ('LDZ', 'LDZTokenMintAddressHere123456789', 6, true);");
      return;
    }

    const ldzTokenId = ldzTokenResult.rows[0].id;
    console.log(`\n💰 LDZ token ID: ${ldzTokenId}`);

    // Ask for confirmation
    console.log(`\n🔧 Ready to fix ${brokenTraits.rows.length} traits by setting their price_token_id to LDZ token ID.`);
    console.log('This will change their payment token from SOL to LDZ.');
    
    // For automation, let's proceed with the fix
    console.log('\n⚡ Applying fixes...');

    const fixQuery = `
      UPDATE traits 
      SET price_token_id = $1
      WHERE price_token_id = slot_id;
    `;

    const fixResult = await client.query(fixQuery, [ldzTokenId]);
    console.log(`✅ Fixed ${fixResult.rowCount} traits`);

    // Verify the fix
    console.log('\n🔍 Verifying fixes...');
    const verifyResult = await client.query(checkQuery);
    
    console.log('\nUpdated trait token assignments:');
    verifyResult.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.price_amount} ${row.current_token_symbol || 'NULL'} (${row.status})`);
    });

    // Check if any traits still have issues
    const stillBrokenResult = await client.query(brokenTraitsQuery);
    
    if (stillBrokenResult.rows.length === 0) {
      console.log('\n🎉 All traits fixed successfully!');
      console.log('The "100 LDZ shows as 100 SOL" bug should now be resolved.');
    } else {
      console.log(`\n⚠️ ${stillBrokenResult.rows.length} traits still have issues`);
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the fix
console.log('🔧 Fixing Trait Token ID Mismatch');
console.log('==================================');

fixTraitTokenIds().catch(console.error);