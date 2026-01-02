#!/usr/bin/env node

/**
 * Comprehensive verification of the current application state
 */

const http = require('http');

async function verifyState() {
  console.log('🔍 Comprehensive Application State Verification');
  console.log('===============================================\n');

  try {
    // Test 1: API Response
    console.log('📡 Test 1: API Response');
    const apiData = await testAPI();
    
    // Test 2: Database Direct Query
    console.log('\n🗄️  Test 2: Database Direct Query');
    await testDatabase();
    
    // Test 3: Payment Calculation Logic
    console.log('\n🧮 Test 3: Payment Calculation Logic');
    testCalculationLogic(apiData);
    
    console.log('\n✅ Verification Complete!');
    console.log('\n💡 Next Steps for User:');
    console.log('1. Open browser to http://localhost:3002/marketplace');
    console.log('2. Open browser developer tools (F12)');
    console.log('3. Go to Console tab');
    console.log('4. Connect wallet and select an NFT');
    console.log('5. Select Celestial Rift trait');
    console.log('6. Check console for debug messages');
    console.log('7. Verify the price shows "100 LDZ" not "100 SOL"');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function testAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/traits?active=1',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('- Status:', res.statusCode);
          console.log('- Traits count:', response.data?.length || 0);
          
          const celestialRift = response.data?.find(t => t.name === 'Celestial Rift');
          if (celestialRift) {
            console.log('- Celestial Rift: ✅ Found');
            console.log('  - Price:', celestialRift.priceAmount, celestialRift.priceToken.symbol);
            console.log('  - Token ID:', celestialRift.priceToken.id);
          } else {
            console.log('- Celestial Rift: ❌ Not found');
          }
          
          resolve(response.data || []);
        } catch (error) {
          console.log('- Parse error:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log('- Request error:', error.message);
      reject(error);
    });

    req.end();
  });
}

async function testDatabase() {
  const { Pool } = require('pg');
  const pool = new Pool({ 
    connectionString: 'postgresql://localhost:5432/nft_trait_marketplace_dev' 
  });

  try {
    const result = await pool.query(`
      SELECT 
        t.name,
        t.price_amount,
        tok.symbol,
        tok.id as token_id,
        t.active
      FROM traits t
      LEFT JOIN tokens tok ON t.price_token_id = tok.id
      WHERE t.name = 'Celestial Rift'
    `);

    if (result.rows.length > 0) {
      const trait = result.rows[0];
      console.log('- Celestial Rift in DB: ✅ Found');
      console.log('  - Price:', trait.price_amount, trait.symbol);
      console.log('  - Token ID:', trait.token_id);
      console.log('  - Active:', trait.active);
    } else {
      console.log('- Celestial Rift in DB: ❌ Not found');
    }
  } catch (error) {
    console.log('- Database error:', error.message);
  } finally {
    await pool.end();
  }
}

function testCalculationLogic(traits) {
  const celestialRift = traits.find(t => t.name === 'Celestial Rift');
  
  if (!celestialRift) {
    console.log('- Cannot test: Celestial Rift not available');
    return;
  }

  // Simulate frontend selection
  const selectedTraits = { [celestialRift.slotId]: celestialRift };
  const traitsArray = Object.values(selectedTraits);
  
  let solTotal = 0;
  let ldzTotal = 0;
  
  traitsArray.forEach(trait => {
    const amount = Number(trait.priceAmount);
    if (trait.priceToken.symbol === 'SOL') {
      solTotal += amount;
    } else if (trait.priceToken.symbol === 'LDZ') {
      ldzTotal += amount;
    }
  });

  console.log('- Input trait:', celestialRift.name);
  console.log('- Input price:', celestialRift.priceAmount, celestialRift.priceToken.symbol);
  console.log('- Calculated SOL total:', solTotal);
  console.log('- Calculated LDZ total:', ldzTotal);
  
  if (ldzTotal === 100 && solTotal === 0) {
    console.log('- Result: ✅ Correct - should show "100 LDZ"');
  } else {
    console.log('- Result: ❌ Incorrect calculation');
  }
}

verifyState();