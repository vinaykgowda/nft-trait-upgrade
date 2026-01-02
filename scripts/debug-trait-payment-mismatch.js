#!/usr/bin/env node

/**
 * Debug script to identify the payment calculation mismatch
 * The UI shows "100 LDZ" but total shows "100 SOL"
 */

console.log('🔍 Debugging Trait Payment Mismatch\n');

console.log('Issue: Trait shows "100 LDZ" but total shows "100 SOL"');
console.log('This suggests the trait data has inconsistent token information.\n');

// Simulate the exact scenario from the screenshot
const mockTraitFromScreenshot = {
  id: 'celestial-rift-trait',
  name: 'Celestial Rift',
  priceAmount: '100',
  priceToken: {
    id: 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb', // This is the slot ID, not token ID!
    symbol: 'SOL', // This is wrong - should be 'LDZ'
    mintAddress: null,
    decimals: 9,
    enabled: true
  },
  slotId: 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb'
};

console.log('🚨 PROBLEM IDENTIFIED:');
console.log('The trait.priceToken.id is set to the SLOT ID instead of TOKEN ID!');
console.log('');
console.log('Current trait data:');
console.log('- priceToken.id:', mockTraitFromScreenshot.priceToken.id);
console.log('- priceToken.symbol:', mockTraitFromScreenshot.priceToken.symbol);
console.log('- slotId:', mockTraitFromScreenshot.slotId);
console.log('');

console.log('❌ The priceToken.id matches the slotId - this is wrong!');
console.log('❌ The priceToken.symbol is "SOL" but should be "LDZ"');
console.log('');

// Show what the correct data should look like
const correctTraitData = {
  id: 'celestial-rift-trait',
  name: 'Celestial Rift',
  priceAmount: '100',
  priceToken: {
    id: 'ldz-token-uuid', // Should be actual LDZ token UUID
    symbol: 'LDZ', // Should be 'LDZ'
    mintAddress: 'LDZTokenMintAddressHere123456789',
    decimals: 6,
    enabled: true
  },
  slotId: 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb'
};

console.log('✅ CORRECT trait data should be:');
console.log('- priceToken.id:', correctTraitData.priceToken.id);
console.log('- priceToken.symbol:', correctTraitData.priceToken.symbol);
console.log('- slotId:', correctTraitData.slotId);
console.log('');

// Test the payment calculation with both scenarios
function calculatePayment(traits) {
  let solTotal = 0;
  let ldzTotal = 0;
  
  traits.forEach(trait => {
    const amount = Number(trait.priceAmount);
    if (trait.priceToken.symbol === 'SOL') {
      solTotal += amount;
    } else if (trait.priceToken.symbol === 'LDZ') {
      ldzTotal += amount;
    }
  });

  return { solTotal, ldzTotal };
}

console.log('🧪 Testing payment calculations:');
console.log('');

const wrongResult = calculatePayment([mockTraitFromScreenshot]);
console.log('❌ With WRONG data (current):');
console.log('   SOL Total:', wrongResult.solTotal);
console.log('   LDZ Total:', wrongResult.ldzTotal);
console.log('   Result: Shows as "100 SOL" (incorrect)');
console.log('');

const correctResult = calculatePayment([correctTraitData]);
console.log('✅ With CORRECT data (fixed):');
console.log('   SOL Total:', correctResult.solTotal);
console.log('   LDZ Total:', correctResult.ldzTotal);
console.log('   Result: Shows as "100 LDZ" (correct)');
console.log('');

console.log('🔧 ROOT CAUSE:');
console.log('The trait database has incorrect price_token_id values.');
console.log('They are set to slot UUIDs instead of actual token UUIDs.');
console.log('');

console.log('💡 SOLUTION:');
console.log('1. Check the traits table in database');
console.log('2. Find traits with price_token_id = slot_id (wrong)');
console.log('3. Update price_token_id to correct LDZ token UUID');
console.log('4. Verify token symbol is fetched correctly');
console.log('');

console.log('🔍 SQL to check the issue:');
console.log(`
SELECT 
  t.name,
  t.price_amount,
  t.price_token_id,
  t.slot_id,
  tok.symbol as token_symbol,
  CASE 
    WHEN t.price_token_id = t.slot_id THEN 'WRONG - token_id matches slot_id'
    ELSE 'OK'
  END as status
FROM traits t
LEFT JOIN tokens tok ON t.price_token_id = tok.id
WHERE t.name = 'Celestial Rift';
`);

console.log('🚀 Quick fix command:');
console.log(`
-- Find the correct LDZ token ID
SELECT id, symbol FROM tokens WHERE symbol = 'LDZ';

-- Update the trait to use correct token ID
UPDATE traits 
SET price_token_id = (SELECT id FROM tokens WHERE symbol = 'LDZ' LIMIT 1)
WHERE name = 'Celestial Rift' AND price_token_id = slot_id;
`);

console.log('');
console.log('This will fix the "100 LDZ shows as 100 SOL" bug immediately!');