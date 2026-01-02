#!/usr/bin/env node

/**
 * Debug the purchase flow step by step
 */

const http = require('http');

async function testPurchaseFlow() {
  console.log('🔍 Testing Purchase Flow Debug\n');

  const testData = {
    walletAddress: 'EE72RERKxoJFt61MFZSnWvztjD43zPDr2aVizkS41nLC', // Test wallet
    assetId: 'TestAsset123456789012345678901234567890', // Test asset
    traitIds: ['87bcfdb2-5460-4990-be1a-ac323c4b9917'] // Celestial Rift
  };

  // Step 1: Test reservation
  console.log('📋 Step 1: Testing reservation...');
  try {
    const reservationResponse = await makeRequest('POST', '/api/reserve', testData);
    console.log('✅ Reservation response:', reservationResponse);
    
    if (reservationResponse.reservationId || reservationResponse.data?.reservations?.[0]?.id) {
      const reservationId = reservationResponse.reservationId || reservationResponse.data.reservations[0].id;
      console.log('📝 Reservation ID:', reservationId);
      
      // Step 2: Test transaction build
      console.log('\n🔨 Step 2: Testing transaction build...');
      const buildData = {
        walletAddress: testData.walletAddress,
        assetId: testData.assetId,
        reservationId: reservationId,
        paymentToken: 'LDZ',
        totalAmount: 100,
        transactionType: 'payment'
      };
      
      console.log('📤 Sending build request:', buildData);
      
      const buildResponse = await makeRequest('POST', '/api/tx/build', buildData);
      console.log('✅ Build response:', buildResponse);
      
    } else {
      console.log('❌ No reservation ID found in response');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${response.message || response.error || 'Unknown error'}`));
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Run the test
testPurchaseFlow().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});