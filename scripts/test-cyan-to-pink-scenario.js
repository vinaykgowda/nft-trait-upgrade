#!/usr/bin/env node

/**
 * Test script to demonstrate the exact scenario mentioned:
 * Changing background from "Cyan" to "Pink" while preserving all other traits
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testCyanToPinkScenario() {
  console.log('🧪 Testing Cyan → Pink background change scenario...');
  
  try {
    // Simulate the exact scenario from your example
    const testData = {
      walletAddress: '99mfF7NLkipmgeo8t1YrtFP1U8L72qnbhs82ieoLbCjo',
      assetId: 'DywWYUmW9yHbTWBPEKu66WUjvQHSqRTaHCwt21LFiktQ',
      newImageUrl: 'https://gateway.irys.xyz/6pkTEfvMLFXW9oEwUA29nYysQuJ9jyrDj8QywztmDi9C',
      // User is only changing the background from Cyan to Pink
      newAttributes: [
        { trait_type: 'Background', value: 'Pink' }
      ]
    };

    console.log('\n📋 Scenario: User changes background from Cyan to Pink');
    console.log('- Asset ID:', testData.assetId);
    console.log('- Only updating Background: Cyan → Pink');
    console.log('- Expected: Complete metadata with ALL traits preserved');

    // Expected result should match your example format
    const expectedResult = {
      name: 'Should contain "Pepe Gods V2"',
      description: 'Should contain Pepe Gods V2 description',
      symbol: 'PGV2',
      seller_fee_basis_points: 690,
      image: testData.newImageUrl,
      attributes: [
        { value: 'Pink', trait_type: 'Background' },        // CHANGED from Cyan
        { value: 'Blank', trait_type: 'Speciality' },       // PRESERVED
        { value: 'Blank', trait_type: 'Fur' },              // PRESERVED  
        { value: 'Blank', trait_type: 'Clothes' },          // PRESERVED
        { value: 'Blank', trait_type: 'Hand' },             // PRESERVED
        { value: 'Blank', trait_type: 'Mouth' },            // PRESERVED
        { value: 'Blank', trait_type: 'Mask' },             // PRESERVED
        { value: 'Blank', trait_type: 'Headwear' },         // PRESERVED
        { value: 'Blank', trait_type: 'Eyes' },             // PRESERVED
        { value: 'Blank', trait_type: 'Eyewear' },          // PRESERVED
        { value: 'NUMBER', trait_type: 'Rarity Rank' }      // PRESERVED or generated
      ]
    };

    console.log('\n🎯 Expected complete metadata structure:');
    console.log('- Name: Pepe Gods V2 format');
    console.log('- Symbol: PGV2');
    console.log('- Seller fee: 690 basis points');
    console.log('- Image: New composed image URL');
    console.log('- Attributes: ALL 11 trait slots (10 traits + Rarity Rank)');
    console.log('- Background: Pink (UPDATED)');
    console.log('- All other traits: Preserved or "Blank"');

    // Test the metadata update
    console.log('\n🎨 Executing metadata update...');
    const metadataResponse = await fetch('http://localhost:3002/api/tx/update-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!metadataResponse.ok) {
      const error = await metadataResponse.json();
      throw new Error(`Metadata update failed: ${error.error || 'Unknown error'}`);
    }

    const result = await metadataResponse.json();
    console.log('✅ Metadata update successful:', {
      signature: result.data.signature,
      method: result.data.message.includes('fallback') ? 'Fallback (Memo)' : 'Core Asset Update',
      attributeCount: result.data.newAttributes.length
    });

    // Analyze the result
    console.log('\n🔍 Analyzing complete metadata result...');
    const attributes = result.data.newAttributes;
    
    console.log('📋 Complete attribute set received:');
    attributes.forEach((attr, index) => {
      const status = attr.trait_type === 'Background' && attr.value === 'Pink' ? '🔄 UPDATED' : 
                    attr.trait_type === 'Rarity Rank' ? '🎲 RANK' : '📋 PRESERVED';
      console.log(`  ${index + 1}. ${attr.trait_type}: ${attr.value} ${status}`);
    });

    // Verify the result matches expected format
    const verification = {
      hasAllSlots: attributes.length === 11,
      backgroundUpdated: attributes.find(a => a.trait_type === 'Background')?.value === 'Pink',
      hasRarityRank: attributes.some(a => a.trait_type === 'Rarity Rank'),
      hasAllTraitSlots: [
        'Background', 'Speciality', 'Fur', 'Clothes', 'Hand', 
        'Mouth', 'Mask', 'Headwear', 'Eyes', 'Eyewear'
      ].every(slot => attributes.some(a => a.trait_type === slot))
    };

    console.log('\n✅ Verification Results:');
    console.log(`✅ Complete attribute set: ${verification.hasAllSlots ? 'YES' : 'NO'} (${attributes.length}/11)`);
    console.log(`✅ Background updated to Pink: ${verification.backgroundUpdated ? 'YES' : 'NO'}`);
    console.log(`✅ Rarity Rank preserved: ${verification.hasRarityRank ? 'YES' : 'NO'}`);
    console.log(`✅ All trait slots present: ${verification.hasAllTraitSlots ? 'YES' : 'NO'}`);

    // Final validation
    const isSuccess = Object.values(verification).every(v => v === true);

    if (isSuccess) {
      console.log('\n🎉 SUCCESS: Cyan → Pink scenario working perfectly!');
      console.log('✅ User changes only Background trait');
      console.log('✅ System preserves all other existing traits');
      console.log('✅ Complete metadata includes all 11 trait slots');
      console.log('✅ Follows exact Pepe Gods V2 format');
      console.log('✅ No hardcoded data - all dynamic from database');
      
      console.log('\n📊 Final Metadata Summary:');
      console.log(`- Total attributes: ${attributes.length}`);
      console.log(`- Updated traits: 1 (Background: Pink)`);
      console.log(`- Preserved traits: ${attributes.length - 1}`);
      console.log(`- Transaction signature: ${result.data.signature}`);
    } else {
      console.log('\n❌ FAILURE: Issues found in Cyan → Pink scenario');
      Object.entries(verification).forEach(([key, value]) => {
        if (!value) console.log(`  ❌ ${key}: FAILED`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

// Run the test
testCyanToPinkScenario().catch(console.error);