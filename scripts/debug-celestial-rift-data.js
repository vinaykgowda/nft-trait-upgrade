#!/usr/bin/env node

/**
 * Debug script to check the exact data for Celestial Rift trait
 */

const { Client } = require('pg');

async function debugCelestialRift() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/nft_trait_marketplace_dev';
  
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database\n');

    // Query the exact same data that the TraitRepository uses
    const query = `
      SELECT 
        t.*,
        ts.name as slot_name,
        ts.layer_order as slot_layer_order,
        rt.name as rarity_name,
        rt.weight as rarity_weight,
        tok.symbol as token_symbol,
        tok.decimals as token_decimals,
        tok.mint_address as token_mint_address
      FROM traits t
      LEFT JOIN trait_slots ts ON t.slot_id = ts.id
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
      LEFT JOIN tokens tok ON t.price_token_id = tok.id
      WHERE t.name = 'Celestial Rift'
      AND t.active = true;
    `;

    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No Celestial Rift trait found');
      return;
    }

    const trait = result.rows[0];
    
    console.log('🎯 Celestial Rift Raw Database Data:');
    console.log('=====================================');
    console.log('Trait ID:', trait.id);
    console.log('Name:', trait.name);
    console.log('Price Amount:', trait.price_amount);
    console.log('Price Token ID:', trait.price_token_id);
    console.log('Slot ID:', trait.slot_id);
    console.log('');
    
    console.log('Token Information (from JOIN):');
    console.log('- Token Symbol:', trait.token_symbol);
    console.log('- Token Decimals:', trait.token_decimals);
    console.log('- Token Mint Address:', trait.token_mint_address);
    console.log('');
    
    console.log('Slot Information:');
    console.log('- Slot Name:', trait.slot_name);
    console.log('- Slot Layer Order:', trait.slot_layer_order);
    console.log('');
    
    console.log('Rarity Information:');
    console.log('- Rarity Name:', trait.rarity_name);
    console.log('- Rarity Weight:', trait.rarity_weight);
    console.log('');

    // Simulate the toDomain conversion
    console.log('🔄 Simulating toDomain Conversion:');
    console.log('==================================');
    
    const domainTrait = {
      id: trait.id,
      slotId: trait.slot_id,
      name: trait.name,
      imageLayerUrl: trait.image_layer_url,
      rarityTier: {
        id: trait.rarity_tier_id,
        name: trait.rarity_name || 'Common',
        weight: trait.rarity_weight || 50,
        displayOrder: 0,
      },
      totalSupply: trait.total_supply,
      remainingSupply: trait.remaining_supply,
      priceAmount: trait.price_amount,
      priceToken: {
        id: trait.price_token_id,
        symbol: trait.token_symbol || 'UNKNOWN',
        mintAddress: trait.token_mint_address || undefined,
        decimals: trait.token_decimals || 9,
        enabled: true,
      },
      active: trait.active,
    };
    
    console.log('Domain Trait Object:');
    console.log('- priceAmount:', domainTrait.priceAmount);
    console.log('- priceToken.symbol:', domainTrait.priceToken.symbol);
    console.log('- priceToken.id:', domainTrait.priceToken.id);
    console.log('');
    
    // Test the payment calculation
    console.log('🧪 Testing Payment Calculation:');
    console.log('===============================');
    
    let solTotal = 0;
    let ldzTotal = 0;
    const amount = Number(domainTrait.priceAmount);
    
    if (domainTrait.priceToken.symbol === 'SOL') {
      solTotal += amount;
    } else if (domainTrait.priceToken.symbol === 'LDZ') {
      ldzTotal += amount;
    }
    
    console.log('- Amount:', amount);
    console.log('- Token Symbol:', domainTrait.priceToken.symbol);
    console.log('- SOL Total:', solTotal);
    console.log('- LDZ Total:', ldzTotal);
    console.log('');
    
    if (ldzTotal > 0) {
      console.log('✅ Should display: "100 LDZ"');
    } else if (solTotal > 0) {
      console.log('❌ Will display: "100 SOL" (BUG!)');
    } else {
      console.log('⚠️ Will display: "0" (no matching token)');
    }
    
    // Check if there are any issues with the token JOIN
    console.log('\n🔍 Checking Token JOIN:');
    console.log('=======================');
    
    const tokenCheck = await client.query('SELECT * FROM tokens WHERE id = $1', [trait.price_token_id]);
    
    if (tokenCheck.rows.length === 0) {
      console.log('❌ Token not found for ID:', trait.price_token_id);
    } else {
      const token = tokenCheck.rows[0];
      console.log('✅ Token found:');
      console.log('- ID:', token.id);
      console.log('- Symbol:', token.symbol);
      console.log('- Mint Address:', token.mint_address);
      console.log('- Decimals:', token.decimals);
      console.log('- Enabled:', token.enabled);
      
      if (token.symbol !== trait.token_symbol) {
        console.log('❌ MISMATCH: Direct token query shows different symbol!');
        console.log('   Direct query:', token.symbol);
        console.log('   JOIN result:', trait.token_symbol);
      }
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await client.end();
  }
}

console.log('🔍 Debugging Celestial Rift Trait Data');
console.log('======================================\n');

debugCelestialRift().catch(console.error);