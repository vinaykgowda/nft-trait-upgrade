#!/usr/bin/env node

/**
 * Test script to simulate the frontend payment calculation
 * This will help identify where the bug is occurring
 */

const http = require('http');

async function testFrontendCalculation() {
  console.log('🔍 Testing Frontend Payment Calculation\n');

  // Fetch traits from API (simulating frontend)
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
            console.log('📡 API returned', response.data.length, 'traits');
            
            // Find Celestial Rift
            const celestialRift = response.data.find(trait => trait.name === 'Celestial Rift');
            
            if (celestialRift) {
              console.log('\n🎯 Celestial Rift Data from API:');
              console.log('- Name:', celestialRift.name);
              console.log('- Price Amount:', celestialRift.priceAmount, '(type:', typeof celestialRift.priceAmount, ')');
              console.log('- Price Token Symbol:', celestialRift.priceToken.symbol);
              console.log('- Price Token ID:', celestialRift.priceToken.id);
              
              // Simulate the frontend calculation (from TraitMarketplace.tsx)
              console.log('\n🧮 Simulating Frontend Calculation:');
              
              // Create selectedTraits object like frontend does
              const selectedTraits = {
                [celestialRift.slotId]: celestialRift
              };
              
              console.log('- Selected Traits Object:', Object.keys(selectedTraits));
              
              // Simulate getTotalPrice() function
              const traits = Object.values(selectedTraits);
              console.log('- Traits array length:', traits.length);
              
              let solTotal = 0;
              let ldzTotal = 0;
              
              traits.forEach(trait => {
                const amount = Number(trait.priceAmount);
                console.log('- Processing trait:', {
                  name: trait.name,
                  amount: trait.priceAmount,
                  amountAsNumber: amount,
                  tokenSymbol: trait.priceToken.symbol,
                  tokenId: trait.priceToken.id,
                  slotId: trait.slotId
                });
                
                if (trait.priceToken.symbol === 'SOL') {
                  solTotal += amount;
                  console.log('  → Added to SOL total:', amount);
                } else if (trait.priceToken.symbol === 'LDZ') {
                  ldzTotal += amount;
                  console.log('  → Added to LDZ total:', amount);
                } else {
                  console.log('  → Unknown token symbol:', trait.priceToken.symbol);
                }
              });

              console.log('\n💰 Final Calculation Result:');
              console.log('- SOL Total:', solTotal);
              console.log('- LDZ Total:', ldzTotal);
              
              // Simulate the display logic
              if (solTotal > 0 && ldzTotal > 0) {
                console.log('✅ Display: Mixed payment -', `${ldzTotal} LDZ + ${solTotal} SOL`);
              } else if (ldzTotal > 0) {
                console.log('✅ Display: LDZ only -', `${ldzTotal} LDZ`);
              } else if (solTotal > 0) {
                console.log('❌ Display: SOL only -', `${solTotal} SOL` + ' (THIS IS THE BUG!)');
              } else {
                console.log('⚪ Display: No payment -', '0 SOL');
              }
              
            } else {
              console.log('❌ Celestial Rift not found in API response');
            }
            
          } else {
            console.log('❌ Invalid API response format');
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

// Run the test
testFrontendCalculation().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});