#!/usr/bin/env node

/**
 * Test script to verify complete attribute set functionality
 * This ensures all trait slots are included in metadata, not just updated ones
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testCompleteAttributes() {
  console.log('🧪 Testing complete attribute set functionality...');
  
  try {
    // Test scenario: Update only Background and Eyes, but expect ALL trait slots in metadata
    const testData = {
      walletAddress: '99mfF7NLkipmgeo8t1YrtFP1U8L72qnbhs82ieoLbCjo',
      assetId: 'DywWYUmW9yHbTWBPEKu66WUjvQHSqRTaHCwt21LFiktQ',
      newImageUrl: 'https://adznwylv2j3tfcl7.public.blob.vercel-storage.com/nft/test_complete_attributes.jpg',
      // Only updating 2 traits, but should get ALL 11 attributes in response
      newAttributes: [
        { trait_type: 'Background', value: 'Pink' },
        { trait_type: 'Eyes', value: 'Supernova' }
      ]
    };

    console.log('\n📋 Test Scenario:');
    console.log('- Asset ID:', testData.assetId);
    console.log('- Updating only 2 traits:', testData.newAttributes.map(a => `${a.trait_type}: ${a.value}`));
    console.log('- Expected: ALL 11 trait slots in metadata (10 traits + Rarity Rank)');

    // Expected complete attribute set
    const expectedTraitSlots = [
      'Background',    // Should be "Pink" (updated)
      'Speciality',    // Should be "Blank" or existing value
      'Fur',          // Should be "Blank" or existing value
      'Clothes',      // Should be "Blank" or existing value
      'Hand',         // Should be "Blank" or existing value
      'Mouth',        // Should be "Blank" or existing value
      'Mask',         // Should be "Blank" or existing value
      'Headwear',     // Should be "Blank" or existing value
      'Eyes',         // Should be "Supernova" (updated)
      'Eyewear',      // Should be "Blank" or existing value
      'Rarity Rank'   // Should be preserved or generated
    ];

    console.log('\n🎯 Expected trait slots in metadata:', expectedTraitSlots);

    // Test the metadata update API
    console.log('\n🎨 Testing metadata update with complete attributes...');
    const metadataResponse = await fetch('http://localhost:3002/api/tx/update-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!metadataResponse.ok) {
      const error = await metadataResponse.json();
      throw new Error(`Metadata update failed: ${error.error || 'Unknown error'}`);
    }

    const metadataResult = await metadataResponse.json();
    console.log('✅ Metadata update successful:', {
      signature: metadataResult.data.signature,
      attributeCount: metadataResult.data.newAttributes.length
    });

    // Verify the complete attribute set
    console.log('\n🔍 Verifying complete attribute set...');
    const receivedAttributes = metadataResult.data.newAttributes;
    
    console.log('📋 Received attributes:');
    receivedAttributes.forEach((attr, index) => {
      console.log(`  ${index + 1}. ${attr.trait_type}: ${attr.value}`);
    });

    // Check if all expected trait slots are present
    const missingSlots = [];
    const presentSlots = [];
    
    for (const expectedSlot of expectedTraitSlots) {
      const found = receivedAttributes.find(attr => attr.trait_type === expectedSlot);
      if (found) {
        presentSlots.push(`${expectedSlot}: ${found.value}`);
      } else {
        missingSlots.push(expectedSlot);
      }
    }

    console.log('\n✅ Present trait slots:', presentSlots.length);
    presentSlots.forEach(slot => console.log(`  ✓ ${slot}`));

    if (missingSlots.length > 0) {
      console.log('\n❌ Missing trait slots:', missingSlots.length);
      missingSlots.forEach(slot => console.log(`  ✗ ${slot}`));
    }

    // Verify specific updates
    const backgroundAttr = receivedAttributes.find(attr => attr.trait_type === 'Background');
    const eyesAttr = receivedAttributes.find(attr => attr.trait_type === 'Eyes');
    const rarityAttr = receivedAttributes.find(attr => attr.trait_type === 'Rarity Rank');

    console.log('\n🎯 Verification Results:');
    console.log(`✅ Total attributes: ${receivedAttributes.length} (expected: 11)`);
    console.log(`✅ Background updated: ${backgroundAttr?.value === 'Pink' ? 'YES' : 'NO'} (${backgroundAttr?.value})`);
    console.log(`✅ Eyes updated: ${eyesAttr?.value === 'Supernova' ? 'YES' : 'NO'} (${eyesAttr?.value})`);
    console.log(`✅ Rarity Rank present: ${rarityAttr ? 'YES' : 'NO'} (${rarityAttr?.value})`);
    console.log(`✅ All trait slots covered: ${missingSlots.length === 0 ? 'YES' : 'NO'}`);

    // Final validation
    const isValid = (
      receivedAttributes.length === 11 &&
      backgroundAttr?.value === 'Pink' &&
      eyesAttr?.value === 'Supernova' &&
      rarityAttr &&
      missingSlots.length === 0
    );

    if (isValid) {
      console.log('\n🎉 SUCCESS: Complete attribute set is working correctly!');
      console.log('✅ All trait slots are included in metadata');
      console.log('✅ Updated traits have correct values');
      console.log('✅ Non-updated traits have default or existing values');
      console.log('✅ Rarity Rank is preserved/generated');
    } else {
      console.log('\n❌ FAILURE: Complete attribute set is not working correctly');
      console.log('Issues found:');
      if (receivedAttributes.length !== 11) console.log(`  - Wrong attribute count: ${receivedAttributes.length} (expected 11)`);
      if (backgroundAttr?.value !== 'Pink') console.log(`  - Background not updated: ${backgroundAttr?.value}`);
      if (eyesAttr?.value !== 'Supernova') console.log(`  - Eyes not updated: ${eyesAttr?.value}`);
      if (!rarityAttr) console.log('  - Rarity Rank missing');
      if (missingSlots.length > 0) console.log(`  - Missing slots: ${missingSlots.join(', ')}`);
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
testCompleteAttributes().catch(console.error);