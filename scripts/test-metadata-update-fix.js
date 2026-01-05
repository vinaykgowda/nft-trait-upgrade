#!/usr/bin/env node

/**
 * Test script to debug the metadata update issue
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

async function testMetadataUpdate() {
  console.log('🧪 Testing metadata update functionality...');
  
  try {
    // Test environment variables
    console.log('\n📋 Environment Check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- SOLANA_DELEGATE_PRIVATE_KEY:', process.env.SOLANA_DELEGATE_PRIVATE_KEY ? 'SET' : 'NOT SET');
    console.log('- IRYS_PRIVATE_KEY:', process.env.IRYS_PRIVATE_KEY ? 'SET' : 'NOT SET');
    console.log('- HELIUS_API_KEY:', process.env.HELIUS_API_KEY ? 'SET' : 'NOT SET');
    
    // Test delegate keypair initialization
    console.log('\n🔑 Testing delegate keypair initialization...');
    const delegatePrivateKey = process.env.SOLANA_DELEGATE_PRIVATE_KEY;
    if (!delegatePrivateKey) {
      throw new Error('SOLANA_DELEGATE_PRIVATE_KEY not set');
    }
    
    let delegateKeypair;
    try {
      if (delegatePrivateKey.startsWith('[') && delegatePrivateKey.endsWith(']')) {
        // JSON array format
        delegateKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(delegatePrivateKey)));
      } else {
        // Base58 string format
        const bs58 = require('bs58');
        delegateKeypair = Keypair.fromSecretKey(bs58.decode(delegatePrivateKey));
      }
      console.log('✅ Delegate keypair initialized successfully');
      console.log('- Public Key:', delegateKeypair.publicKey.toString());
    } catch (error) {
      console.error('❌ Failed to initialize delegate keypair:', error.message);
      return;
    }
    
    // Test RPC connection
    console.log('\n🌐 Testing RPC connection...');
    const rpcUrl = process.env.HELIUS_API_KEY 
      ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';
    
    console.log('- RPC URL:', rpcUrl.replace(process.env.HELIUS_API_KEY || '', '[API_KEY]'));
    
    const connection = new Connection(rpcUrl, 'confirmed');
    
    try {
      const slot = await connection.getSlot();
      console.log('✅ RPC connection successful, current slot:', slot);
    } catch (error) {
      console.error('❌ RPC connection failed:', error.message);
      return;
    }
    
    // Test delegate account balance
    console.log('\n💰 Checking delegate account balance...');
    try {
      const balance = await connection.getBalance(delegateKeypair.publicKey);
      console.log('- Balance:', balance / 1e9, 'SOL');
      
      if (balance === 0) {
        console.warn('⚠️ Delegate account has no SOL balance - transactions will fail');
      }
    } catch (error) {
      console.error('❌ Failed to check balance:', error.message);
    }
    
    // Test API endpoint
    console.log('\n🔗 Testing metadata update API endpoint...');
    const testPayload = {
      walletAddress: '99mfF7NLkipmgeo8t1YrtFP1U8L72qnbhs82ieoLbCjo',
      assetId: 'DywWYUmW9yHbTWBPEKu66WUjvQHSqRTaHCwt21LFiktQ',
      newImageUrl: 'https://adznwylv2j3tfcl7.public.blob.vercel-storage.com/nft/test_image.jpg',
      newAttributes: [
        { trait_type: 'Background', value: 'Blue' },
        { trait_type: 'Eyes', value: 'Green' }
      ]
    };
    
    console.log('- Test payload:', JSON.stringify(testPayload, null, 2));
    
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const endpoint = `${apiUrl}/api/tx/update-metadata`;
    
    console.log('- API endpoint:', endpoint);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });
      
      const result = await response.json();
      
      console.log('- Response status:', response.status);
      console.log('- Response body:', JSON.stringify(result, null, 2));
      
      if (response.ok) {
        console.log('✅ API test successful');
      } else {
        console.error('❌ API test failed');
      }
    } catch (error) {
      console.error('❌ API test error:', error.message);
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('- Environment variables: Check logs above');
    console.log('- Delegate keypair: Check initialization status');
    console.log('- RPC connection: Check connection status');
    console.log('- Account balance: Check if delegate has SOL');
    console.log('- API endpoint: Check response status and errors');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMetadataUpdate().catch(console.error);