#!/usr/bin/env node

/**
 * Test mixed payment scenario to see if this is causing the confusion
 */

const http = require('http');

async function testMixedPayment() {
  console.log('🔍 Testing Mixed Payment Scenario\n');

  // Fetch traits from API
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/traits?active=1',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.data && Array.isArray(response.data)) {
            console.log('📡 Active traits found:', response.data.length);
            
            // Show all active traits
            console.log('\n🎯 All Active Traits:');
            response.data.forEach(trait => {
              console.log(`- ${trait.name}: ${trait.priceAmount} ${trait.priceToken.symbol} (${trait.rarityTier?.name || 'Unknown'})`);
            });
            
            // Test scenario 1: Celestial Rift only
            console.log('\n📊 Scenario 1: Celestial Rift Only');
            const celestialRift = response.data.find(t => t.name === 'Celestial Rift');
            if (celestialRift) {
              const selectedTraits1 = { [celestialRift.slotId]: celestialRift };
              const result1 = calculatePayment(Object.values(selectedTraits1));
              console.log('Result:', result1);
            }
            
            // Test scenario 2: PEPE only
            console.log('\n📊 Scenario 2: PEPE Only');
            const pepe = response.data.find(t => t.name === 'PEPE');
            if (pepe) {
              const selectedTraits2 = { [pepe.slotId]: pepe };
              const result2 = calculatePayment(Object.values(selectedTraits2));
              console.log('Result:', result2);
            }
            
            // Test scenario 3: Mixed payment (if possible)
            console.log('\n📊 Scenario 3: Mixed Payment (Celestial Rift + Teal)');
            const teal = response.data.find(t => t.name === 'Teal');
            if (celestialRift && teal) {
              // Note: This shouldn't be possible since both are Background traits
              // but let's test the calculation logic
              const selectedTraits3 = { 
                trait1: celestialRift,
                trait2: teal
              };
              const result3 = calculatePayment(Object.values(selectedTraits3));
              console.log('Result:', result3);
            }
            
            // Test scenario 4: What if user somehow has wrong data
            console.log('\n📊 Scenario 4: Simulating Bug - Wrong Token Data');
            if (celestialRift) {
              // Simulate if the token data was corrupted
              const corruptedTrait = {
                ...celestialRift,
                priceToken: {
                  ...celestialRift.priceToken,
                  symbol: 'SOL' // Wrong!
                }
              };
              const selectedTraits4 = { [corruptedTrait.slotId]: corruptedTrait };
              const result4 = calculatePayment(Object.values(selectedTraits4));
              console.log('Result (with corrupted data):', result4);
            }
            
          }
          
          resolve();
        } catch (error) {
          console.error('❌ Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.end();
  });
}

function calculatePayment(traits) {
  let solTotal = 0;
  let ldzTotal = 0;
  
  traits.forEach(trait => {
    const amount = Number(trait.priceAmount);
    console.log(`  Processing: ${trait.name} - ${trait.priceAmount} ${trait.priceToken.symbol}`);
    
    if (trait.priceToken.symbol === 'SOL') {
      solTotal += amount;
    } else if (trait.priceToken.symbol === 'LDZ') {
      ldzTotal += amount;
    }
  });

  console.log(`  Totals: ${solTotal} SOL, ${ldzTotal} LDZ`);

  // Return display text like frontend does
  if (solTotal > 0 && ldzTotal > 0) {
    return {
      type: 'mixed',
      display: `${ldzTotal} LDZ + ${solTotal} SOL`,
      solTotal,
      ldzTotal
    };
  } else if (ldzTotal > 0) {
    return {
      type: 'ldz_only',
      display: `${ldzTotal} LDZ`,
      ldzTotal
    };
  } else if (solTotal > 0) {
    return {
      type: 'sol_only',
      display: `${solTotal} SOL`,
      solTotal
    };
  } else {
    return {
      type: 'none',
      display: '0 SOL'
    };
  }
}

// Run the test
testMixedPayment().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});