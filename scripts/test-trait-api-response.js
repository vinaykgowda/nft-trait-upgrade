#!/usr/bin/env node

/**
 * Test script to check what the traits API is actually returning
 * This will help identify if the issue is in the API response or frontend processing
 */

const http = require('http');

async function testTraitAPI() {
  console.log('🔍 Testing Traits API Response\n');

  // Test the traits API endpoint
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
          console.log('📡 API Response Status:', res.statusCode);
          
          if (response.data && Array.isArray(response.data)) {
            console.log(`📊 Found ${response.data.length} traits\n`);
            
            // Find the Celestial Rift trait
            const celestialRift = response.data.find(trait => trait.name === 'Celestial Rift');
            
            if (celestialRift) {
              console.log('🎯 Found Celestial Rift trait:');
              console.log('- ID:', celestialRift.id);
              console.log('- Name:', celestialRift.name);
              console.log('- Price Amount:', celestialRift.priceAmount);
              console.log('- Price Token:', JSON.stringify(celestialRift.priceToken, null, 2));
              console.log('- Slot ID:', celestialRift.slotId);
              console.log('');
              
              // Check if the token data is correct
              if (celestialRift.priceToken.symbol === 'LDZ') {
                console.log('✅ Token symbol is correct: LDZ');
              } else {
                console.log('❌ Token symbol is wrong:', celestialRift.priceToken.symbol);
              }
              
              // Test the payment calculation logic
              console.log('\n🧪 Testing payment calculation:');
              const amount = Number(celestialRift.priceAmount);
              let solTotal = 0;
              let ldzTotal = 0;
              
              if (celestialRift.priceToken.symbol === 'SOL') {
                solTotal += amount;
              } else if (celestialRift.priceToken.symbol === 'LDZ') {
                ldzTotal += amount;
              }
              
              console.log('- SOL Total:', solTotal);
              console.log('- LDZ Total:', ldzTotal);
              
              if (ldzTotal > 0) {
                console.log('✅ Should display as: "100 LDZ"');
              } else if (solTotal > 0) {
                console.log('❌ Will display as: "100 SOL" (this is the bug!)');
              }
              
            } else {
              console.log('❌ Celestial Rift trait not found in API response');
              
              // Show all available traits
              console.log('\n📋 Available traits:');
              response.data.slice(0, 10).forEach(trait => {
                console.log(`- ${trait.name}: ${trait.priceAmount} ${trait.priceToken.symbol}`);
              });
              if (response.data.length > 10) {
                console.log(`... and ${response.data.length - 10} more`);
              }
            }
            
          } else {
            console.log('❌ Unexpected API response format:', response);
          }
          
          resolve();
        } catch (error) {
          console.error('❌ Failed to parse API response:', error);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ API request failed:', error.message);
      console.log('Make sure the development server is running on localhost:3002');
      reject(error);
    });

    req.end();
  });
}

// Run the test
testTraitAPI().catch(() => {
  console.log('\n💡 To run this test:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Run this script again');
  process.exit(1);
});