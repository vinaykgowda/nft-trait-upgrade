#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Simple fetch implementation for Node.js
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = lib.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

const BASE_URL = 'http://localhost:3002';
const TEST_NFT_ADDRESS = 'test123';

async function testTraitUpdateScenarios() {
  console.log('🧪 Testing Different Trait Update Scenarios');
  console.log('============================================\n');

  try {
    // Get initial NFT data
    console.log('📋 Getting initial NFT data...');
    const previewResponse = await fetch(`${BASE_URL}/api/nft-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftAddress: TEST_NFT_ADDRESS })
    });

    const previewData = await previewResponse.json();
    console.log('✅ Initial NFT traits:');
    previewData.traitDetails.forEach(trait => {
      console.log(`   - ${trait.slotName}: ${trait.traitName}`);
    });

    // Scenario 1: Update only Background trait
    console.log('\n🎨 Scenario 1: Update only Background trait (Cyan → Pink)');
    await testMetadataUpdate('Background Update', [
      {
        slotId: previewData.traitDetails.find(t => t.slotName === 'Background')?.slotId,
        name: 'Pink'
      }
    ], previewData.nftAttributes);

    // Scenario 2: Update multiple traits
    console.log('\n🎨 Scenario 2: Update Background and Fur (Cyan → Grey, Magma → Blue)');
    await testMetadataUpdate('Multi-trait Update', [
      {
        slotId: previewData.traitDetails.find(t => t.slotName === 'Background')?.slotId,
        name: 'Grey'
      },
      {
        slotId: previewData.traitDetails.find(t => t.slotName === 'Fur')?.slotId,
        name: 'Blue'
      }
    ], previewData.nftAttributes);

    // Scenario 3: Add trait to blank slot (simulate adding a Hat)
    console.log('\n🎨 Scenario 3: Add trait to previously blank slot (Add Hat)');
    await testMetadataUpdate('Add New Trait', [
      {
        slotId: 'mock-hat-slot-id', // This would be a real slot ID in production
        name: 'Baseball Cap'
      }
    ], [
      ...previewData.nftAttributes,
      { trait_type: 'Hat', value: 'Blank' } // Simulate original blank hat
    ]);

    // Scenario 4: Remove trait (set to Blank)
    console.log('\n🎨 Scenario 4: Remove trait (Clothes → Blank)');
    await testMetadataUpdate('Remove Trait', [
      {
        slotId: previewData.traitDetails.find(t => t.slotName === 'Clothes')?.slotId,
        name: 'Blank'
      }
    ], previewData.nftAttributes);

    console.log('\n🎉 All scenarios tested!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testMetadataUpdate(scenarioName, newTraits, originalTraits) {
  try {
    const response = await fetch(`${BASE_URL}/api/update-nft-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: TEST_NFT_ADDRESS,
        newImageUrl: 'https://example.com/updated-image.png',
        newTraits: newTraits.map(trait => ({
          id: trait.slotId,
          slotId: trait.slotId,
          name: trait.name,
          rarityTier: { id: 'test', name: 'Test' }
        })),
        originalTraits: originalTraits,
        txSignature: `test_${scenarioName.replace(/\s+/g, '_')}_${Date.now()}`
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${scenarioName} successful`);
      console.log(`   - Updated ${data.updatedSlots?.length || 0} slots`);
      console.log(`   - Total attributes: ${data.totalAttributes}`);
      
      if (data.metadata?.attributes) {
        console.log('   - Final trait structure:');
        data.metadata.attributes.forEach(attr => {
          const isUpdated = newTraits.some(t => t.name === attr.value);
          const marker = isUpdated ? '🔄' : '  ';
          console.log(`     ${marker} ${attr.trait_type}: ${attr.value}`);
        });
      }
    } else {
      const errorData = await response.json();
      console.log(`⚠️  ${scenarioName} failed: ${errorData.error}`);
    }
  } catch (error) {
    console.log(`❌ ${scenarioName} error:`, error.message);
  }
}

testTraitUpdateScenarios();