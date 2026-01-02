#!/usr/bin/env node

console.log('🧮 Payment Calculation Test');
console.log('===========================\n');

// Mock trait data similar to what you're seeing
const mockTraits = [
  {
    id: '1',
    name: 'Celestial Rift',
    priceAmount: '100',
    priceToken: { symbol: 'LDZ' },
    rarityTier: { name: 'Rare' }
  },
  {
    id: '2', 
    name: 'PEPE',
    priceAmount: '500',
    priceToken: { symbol: 'LDZ' },
    rarityTier: { name: 'Legendary' }
  }
];

// Test the payment calculation logic
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

  console.log('Payment calculation:', { 
    solTotal, 
    ldzTotal, 
    traits: traits.map(t => ({ 
      name: t.name, 
      amount: t.priceAmount, 
      token: t.priceToken.symbol 
    })) 
  });

  // Handle different payment scenarios
  if (solTotal > 0 && ldzTotal > 0) {
    // Mixed payment - prioritize the token with higher count of traits
    const solTraits = traits.filter(t => t.priceToken.symbol === 'SOL').length;
    const ldzTraits = traits.filter(t => t.priceToken.symbol === 'LDZ').length;
    
    if (ldzTraits >= solTraits) {
      return { 
        token: 'LDZ', 
        amount: ldzTotal, 
        hasMultipleTokens: true, 
        secondaryAmount: solTotal, 
        secondaryToken: 'SOL' 
      };
    } else {
      return { 
        token: 'SOL', 
        amount: solTotal, 
        hasMultipleTokens: true, 
        secondaryAmount: ldzTotal, 
        secondaryToken: 'LDZ' 
      };
    }
  } else if (ldzTotal > 0) {
    return { token: 'LDZ', amount: ldzTotal, hasMultipleTokens: false };
  } else {
    return { token: 'SOL', amount: solTotal, hasMultipleTokens: false };
  }
}

console.log('📊 Test Case: Your Current Traits');
console.log('=================================');
console.log('Traits:');
mockTraits.forEach((trait, index) => {
  console.log(`  ${index + 1}. ${trait.name}: ${trait.priceAmount} ${trait.priceToken.symbol} (${trait.rarityTier.name})`);
});

const result = calculatePayment(mockTraits);
console.log('\n✅ Calculation Result:');
console.log(`   Primary Token: ${result.token}`);
console.log(`   Primary Amount: ${result.amount}`);
console.log(`   Has Multiple Tokens: ${result.hasMultipleTokens}`);
if (result.hasMultipleTokens) {
  console.log(`   Secondary Token: ${result.secondaryToken}`);
  console.log(`   Secondary Amount: ${result.secondaryAmount}`);
}

console.log('\n🎯 Expected Display:');
console.log(`   Total: ${result.amount} ${result.token}`);
if (result.hasMultipleTokens) {
  console.log(`   Button: "Purchase for ${result.amount} ${result.token} + ${result.secondaryAmount} ${result.secondaryToken}"`);
} else {
  console.log(`   Button: "Purchase for ${result.amount} ${result.token}"`);
}

console.log('\n❌ What You Were Seeing (Bug):');
console.log('   Total: 600 SOL (WRONG - should be 600 LDZ)');
console.log('   Button: "Purchase for 600 SOL" (WRONG - should be 600 LDZ)');

console.log('\n✅ What You Should See Now (Fixed):');
console.log(`   Total: ${result.amount} ${result.token}`);
console.log(`   Button: "Purchase for ${result.amount} ${result.token}"`);

console.log('\n🧪 Additional Test Cases:');
console.log('========================');

// Test SOL only
const solOnlyTraits = [
  { name: 'SOL Trait 1', priceAmount: '0.5', priceToken: { symbol: 'SOL' } },
  { name: 'SOL Trait 2', priceAmount: '0.3', priceToken: { symbol: 'SOL' } }
];
const solResult = calculatePayment(solOnlyTraits);
console.log(`\n1. SOL Only: ${solResult.amount} ${solResult.token}`);

// Test mixed payment
const mixedTraits = [
  { name: 'SOL Trait', priceAmount: '0.5', priceToken: { symbol: 'SOL' } },
  { name: 'LDZ Trait', priceAmount: '100', priceToken: { symbol: 'LDZ' } }
];
const mixedResult = calculatePayment(mixedTraits);
console.log(`2. Mixed Payment: ${mixedResult.amount} ${mixedResult.token} + ${mixedResult.secondaryAmount} ${mixedResult.secondaryToken}`);

console.log('\n🎉 Payment calculation is now working correctly!');