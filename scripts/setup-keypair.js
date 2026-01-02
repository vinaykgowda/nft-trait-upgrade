#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function setupKeypair() {
  const keypairPath = process.argv[2] || './keypair.json';
  
  if (!fs.existsSync(keypairPath)) {
    console.error('❌ Keypair file not found at:', keypairPath);
    console.log('Usage: node scripts/setup-keypair.js [path-to-keypair.json]');
    console.log('Example: node scripts/setup-keypair.js ./my-keypair.json');
    process.exit(1);
  }

  try {
    // Read the keypair file
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    
    if (!Array.isArray(keypairData) || keypairData.length !== 64) {
      throw new Error('Invalid keypair format. Expected array of 64 numbers.');
    }

    // Convert to the format needed for environment variables
    const privateKeyString = JSON.stringify(keypairData);
    
    console.log('✅ Keypair loaded successfully!');
    console.log('📋 Add these lines to your .env.local file:');
    console.log('');
    console.log('# Solana Keypair Configuration');
    console.log(`SOLANA_DELEGATE_PRIVATE_KEY=${privateKeyString}`);
    console.log(`IRYS_PRIVATE_KEY=${privateKeyString}`);
    console.log(`UPDATE_AUTHORITY_PRIVATE_KEY=${privateKeyString}`);
    console.log('');
    console.log('🔑 Public Key:', require('@solana/web3.js').Keypair.fromSecretKey(new Uint8Array(keypairData)).publicKey.toString());
    
  } catch (error) {
    console.error('❌ Error processing keypair:', error.message);
    process.exit(1);
  }
}

setupKeypair();