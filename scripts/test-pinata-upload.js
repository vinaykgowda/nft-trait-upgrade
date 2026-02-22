#!/usr/bin/env node

/**
 * Test script to verify Pinata IPFS upload is working correctly
 * 
 * This script:
 * 1. Creates a simple test image
 * 2. Uploads it to Pinata via the /api/upload-image endpoint
 * 3. Verifies the response contains Pinata gateway URL
 * 4. Checks if the image is accessible via the gateway
 */

const sharp = require('sharp');

async function testPinataUpload() {
  console.log('🧪 Testing Pinata IPFS Upload\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Create a simple test image (100x100 WebP)
    console.log('\n📸 Step 1: Creating test WebP image...');
    const testImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 255, alpha: 1 }
      }
    })
    .webp({ quality: 90 })
    .toBuffer();

    console.log(`✅ Test image created: ${testImage.length} bytes`);

    // Step 2: Upload to Pinata via API
    console.log('\n📤 Step 2: Uploading to Pinata via /api/upload-image...');
    
    const uploadResponse = await fetch('http://localhost:3000/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBuffer: testImage.toString('base64'),
        contentType: 'image/webp'
      })
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(`Upload failed: ${JSON.stringify(errorData, null, 2)}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful!');
    console.log('\nUpload Response:');
    console.log(JSON.stringify(uploadResult, null, 2));

    // Step 3: Verify response structure
    console.log('\n🔍 Step 3: Verifying response structure...');
    
    const checks = [
      { name: 'Has success field', pass: uploadResult.success === true },
      { name: 'Has imageUrl field', pass: !!uploadResult.imageUrl },
      { name: 'Has uploadId (CID)', pass: !!uploadResult.uploadId },
      { name: 'Has storage type', pass: uploadResult.storage === 'pinata-ipfs' },
      { name: 'URL contains Pinata gateway', pass: uploadResult.imageUrl?.includes('pinata.cloud') },
      { name: 'URL contains /ipfs/', pass: uploadResult.imageUrl?.includes('/ipfs/') },
      { name: 'URL is HTTPS', pass: uploadResult.imageUrl?.startsWith('https://') }
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✅' : '❌';
      console.log(`${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    if (!allPassed) {
      throw new Error('Response structure validation failed');
    }

    // Step 4: Verify image is accessible via gateway
    console.log('\n🌐 Step 4: Verifying image is accessible via Pinata gateway...');
    console.log(`Gateway URL: ${uploadResult.imageUrl}`);
    
    const gatewayResponse = await fetch(uploadResult.imageUrl);
    
    if (!gatewayResponse.ok) {
      throw new Error(`Gateway returned ${gatewayResponse.status}: ${gatewayResponse.statusText}`);
    }

    const contentType = gatewayResponse.headers.get('content-type');
    const contentLength = gatewayResponse.headers.get('content-length');
    
    console.log(`✅ Image accessible!`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Length: ${contentLength} bytes`);

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n✅ Pinata IPFS upload is working correctly');
    console.log(`✅ CID: ${uploadResult.uploadId}`);
    console.log(`✅ Gateway URL: ${uploadResult.imageUrl}`);
    console.log(`✅ Storage: ${uploadResult.storage}`);

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testPinataUpload();
