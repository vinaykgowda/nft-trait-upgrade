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

// Test configuration
const BASE_URL = 'http://localhost:3002'; // Adjust port as needed
const TEST_NFT_ADDRESS = 'test123'; // Our test NFT

async function testMetadataUpdateFlow() {
  console.log('🧪 Testing NFT Metadata Update Flow');
  console.log('=====================================\n');

  try {
    // Step 1: Test NFT Preview Generation
    console.log('1️⃣ Testing NFT Preview Generation...');
    const previewResponse = await fetch(`${BASE_URL}/api/nft-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftAddress: TEST_NFT_ADDRESS })
    });

    if (!previewResponse.ok) {
      throw new Error(`Preview API failed: ${previewResponse.status}`);
    }

    const previewData = await previewResponse.json();
    console.log('✅ Preview generated successfully');
    console.log(`   - Image size: ${previewData.width}x${previewData.height}`);
    console.log(`   - Mapped traits: ${previewData.mappedTraits}`);
    console.log(`   - Trait details: ${previewData.traitDetails.length} traits`);
    
    // Step 2: Test Image Composition
    console.log('\n2️⃣ Testing Image Composition...');
    const composeResponse = await fetch(`${BASE_URL}/api/compose-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseImageUrl: '/api/transparent-base',
        selectedTraits: previewData.traitDetails.map(trait => ({
          id: trait.slotId,
          slotId: trait.slotId,
          name: trait.traitName,
          imageLayerUrl: `/uploads/traits/${trait.slotName.toLowerCase()}/common/${trait.traitName}_test.png`,
          rarityTier: { id: 'test', name: 'Test', weight: 1 },
          priceAmount: '0',
          priceToken: { id: 'test', symbol: 'TEST', decimals: 9, enabled: true },
          active: true
        }))
      })
    });

    if (!composeResponse.ok) {
      throw new Error(`Compose API failed: ${composeResponse.status}`);
    }

    const composeData = await composeResponse.json();
    console.log('✅ Image composition successful');
    console.log(`   - Final image size: ${composeData.width}x${composeData.height}`);
    console.log(`   - Image buffer size: ${composeData.size} bytes`);

    // Step 3: Test Image Upload to Irys
    console.log('\n3️⃣ Testing Image Upload to Irys...');
    const uploadResponse = await fetch(`${BASE_URL}/api/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBuffer: composeData.imageBuffer,
        contentType: 'image/png'
      })
    });

    let uploadData = null;
    if (uploadResponse.ok) {
      uploadData = await uploadResponse.json();
      console.log('✅ Image uploaded to Irys successfully');
      console.log(`   - Image URL: ${uploadData.imageUrl}`);
      console.log(`   - Upload ID: ${uploadData.uploadId}`);
    } else {
      console.log('⚠️  Image upload failed (expected if keypair not configured)');
      console.log(`   - Status: ${uploadResponse.status}`);
      const errorData = await uploadResponse.json();
      console.log(`   - Error: ${errorData.error}`);
    }

    // Step 4: Test Metadata Update
    console.log('\n4️⃣ Testing NFT Metadata Update...');
    const metadataResponse = await fetch(`${BASE_URL}/api/update-nft-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: TEST_NFT_ADDRESS,
        newImageUrl: uploadData?.imageUrl || 'https://example.com/test-image.png',
        newTraits: [
          // Simulate updating only the Background trait
          {
            id: previewData.traitDetails[0].slotId,
            slotId: previewData.traitDetails[0].slotId,
            name: 'Pink', // Changed from Cyan to Pink
            rarityTier: { id: 'test', name: 'Test' }
          }
        ],
        originalTraits: previewData.nftAttributes, // Pass original NFT attributes
        txSignature: 'test_signature_' + Date.now()
      })
    });

    if (metadataResponse.ok) {
      const metadataData = await metadataResponse.json();
      console.log('✅ Metadata update successful');
      console.log(`   - Metadata URI: ${metadataData.metadataUri}`);
      console.log(`   - Update signature: ${metadataData.updateSignature}`);
      console.log(`   - Updated slots: ${metadataData.updatedSlots?.length || 0}`);
      console.log(`   - Total attributes: ${metadataData.totalAttributes}`);
      
      if (metadataData.metadata?.attributes) {
        console.log('   - Final attributes:');
        metadataData.metadata.attributes.forEach(attr => {
          console.log(`     * ${attr.trait_type}: ${attr.value}`);
        });
      }
    } else {
      console.log('⚠️  Metadata update failed (expected if keypair not configured)');
      console.log(`   - Status: ${metadataResponse.status}`);
      const errorData = await metadataResponse.json();
      console.log(`   - Error: ${errorData.error}`);
    }

    console.log('\n🎉 Test completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Configure your keypair using: node scripts/setup-keypair.js [path-to-keypair.json]');
    console.log('   2. Add the keypair to your .env.local file');
    console.log('   3. Restart your development server');
    console.log('   4. Run this test again to verify full functionality');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testMetadataUpdateFlow();