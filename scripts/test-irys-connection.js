#!/usr/bin/env node

const { Keypair } = require('@solana/web3.js');
const { IrysUploadService } = require('../src/lib/services/irys-upload.ts');
const fs = require('fs');
const path = require('path');

async function testIrysConnection() {
  try {
    console.log('🧪 Testing Irys connection...');

    // Load keypair
    const keypairPath = path.join(__dirname, '../keypair.json');
    if (!fs.existsSync(keypairPath)) {
      console.error('❌ keypair.json not found. Run setup-keypair.js first.');
      process.exit(1);
    }

    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

    console.log(`🔑 Using keypair: ${keypair.publicKey.toString()}`);

    // Initialize Irys service
    const irysService = new IrysUploadService(keypair);

    // Check balance
    console.log('💰 Checking Irys balance...');
    try {
      const balance = await irysService.getBalance();
      console.log(`✅ Current balance: ${balance} atomic units`);
    } catch (error) {
      console.error('❌ Failed to get balance:', error.message);
    }

    // Test small upload
    console.log('📤 Testing small image upload...');
    const testImageBuffer = Buffer.from('test-image-data-for-irys-upload-test', 'utf8');
    
    try {
      const result = await irysService.uploadImage(testImageBuffer, 'text/plain');
      console.log('✅ Test upload successful!');
      console.log(`   - ID: ${result.id}`);
      console.log(`   - URL: ${result.url}`);
      console.log(`   - Size: ${result.size} bytes`);

      // Test if the uploaded content is accessible
      console.log('🔍 Testing URL accessibility...');
      const response = await fetch(result.url);
      if (response.ok) {
        const content = await response.text();
        console.log('✅ Upload is accessible!');
        console.log(`   - Content: ${content}`);
      } else {
        console.warn(`⚠️ Upload not immediately accessible (${response.status}). This is normal for new uploads.`);
      }

    } catch (error) {
      console.error('❌ Test upload failed:', error.message);
      
      if (error.message.includes('balance') || error.message.includes('insufficient')) {
        console.log('💸 Attempting to fund account with 0.1 SOL...');
        try {
          const fundResult = await irysService.fundAccount(0.1);
          if (fundResult.success) {
            console.log(`✅ Account funded successfully: ${fundResult.txId}`);
            console.log('🔄 Retrying upload...');
            
            const retryResult = await irysService.uploadImage(testImageBuffer, 'text/plain');
            console.log('✅ Retry upload successful!');
            console.log(`   - ID: ${retryResult.id}`);
            console.log(`   - URL: ${retryResult.url}`);
          } else {
            console.error('❌ Failed to fund account:', fundResult.error);
          }
        } catch (fundError) {
          console.error('❌ Funding failed:', fundError.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testIrysConnection();
}

module.exports = { testIrysConnection };