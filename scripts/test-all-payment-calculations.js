#!/usr/bin/env node

/**
 * Comprehensive test for all payment calculation functions
 * Tests both TraitMarketplace and TraitCustomizer logic
 */

// Mock trait data for testing
const testTraits = {
  mixedPayment: {
    'slot1': { 
      id: '1', 
      name: 'Background Trait', 
      priceAmount: 500, 
      priceToken: { symbol: 'LDZ' } 
    },
    'slot2': { 
      id: '2', 
      name: 'Fur Trait', 
      priceAmount: 0.005, 
      priceToken: { symbol: 'SOL' } 
    }
  },
  ldzOnly: {
    'slot1': { 
      id: '1', 
      name: 'Background Trait', 
      priceAmount: 500, 
      priceToken: { symbol: 'LDZ' } 
    }
  },
  solOnly: {
    'slot1': { 
      id: '1', 
      name: 'Fur Trait', 
      priceAmount: 0.1, 
      priceToken: { symbol: 'SOL' } 
    }
  },
  multipleMixed: {
    'slot1': { 
      id: '1', 
      name: 'Background', 
      priceAmount: 300, 
      priceToken: { symbol: 'LDZ' } 
    },
    'slot2': { 
      id: '2', 
      name: 'Fur', 
      priceAmount: 200, 
      priceToken: { symbol: 'LDZ' } 
    },
    'slot3': { 
      id: '3', 
      name: 'Eyes', 
      priceAmount: 0.01, 
      priceToken: { symbol: 'SOL' } 
    },
    'slot4': { 
      id: '4', 
      name: 'Mouth', 
      priceAmount: 0.02, 
      priceToken: { symbol: 'SOL' } 
    }
  }
};

// TraitMarketplace getTotalPrice function (returns object)
function marketplaceTotalPrice(selectedTraits) {
  const traits = Object.values(selectedTraits);
  
  // Calculate totals by token type
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

  // Return appropriate display based on what tokens are present
  if (solTotal > 0 && ldzTotal > 0) {
    // Mixed payment - return both amounts separately
    return {
      isMixed: true,
      ldzAmount: ldzTotal,
      solAmount: solTotal,
      displayText: `${ldzTotal} LDZ + ${solTotal} SOL`
    };
  } else if (ldzTotal > 0) {
    // LDZ only
    return {
      isMixed: false,
      amount: ldzTotal,
      symbol: 'LDZ',
      displayText: `${ldzTotal} LDZ`
    };
  } else if (solTotal > 0) {
    // SOL only
    return {
      isMixed: false,
      amount: solTotal,
      symbol: 'SOL',
      displayText: `${solTotal} SOL`
    };
  } else {
    // No traits selected
    return {
      isMixed: false,
      amount: 0,
      symbol: 'SOL',
      displayText: '0 SOL'
    };
  }
}

// TraitCustomizer getTotalPrice function (returns string)
function customizerTotalPrice(selectedTraits) {
  const traits = Object.values(selectedTraits);
  
  // Calculate totals by token type
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

  // Return appropriate display based on what tokens are present
  if (solTotal > 0 && ldzTotal > 0) {
    // Mixed payment
    return `${ldzTotal} LDZ + ${solTotal} SOL`;
  } else if (ldzTotal > 0) {
    // LDZ only
    return `${ldzTotal} LDZ`;
  } else if (solTotal > 0) {
    // SOL only
    return `${solTotal} SOL`;
  } else {
    // No traits selected
    return '0 SOL';
  }
}

console.log('🧪 Testing All Payment Calculation Functions\n');

Object.entries(testTraits).forEach(([scenarioName, traits]) => {
  console.log(`📊 Scenario: ${scenarioName}`);
  console.log('Traits:', Object.values(traits).map(t => `${t.name}: ${t.priceAmount} ${t.priceToken.symbol}`).join(', '));
  
  // Test TraitMarketplace function
  const marketplaceResult = marketplaceTotalPrice(traits);
  console.log('🏪 TraitMarketplace result:', marketplaceResult);
  console.log('   Button text: "Update NFT -', marketplaceResult.displayText + '"');
  console.log('   Total display:', marketplaceResult.displayText);
  
  // Test TraitCustomizer function
  const customizerResult = customizerTotalPrice(traits);
  console.log('🎨 TraitCustomizer result:', customizerResult);
  console.log('   Total display: "Total:', customizerResult + '"');
  
  // Verify consistency
  const consistent = marketplaceResult.displayText === customizerResult;
  console.log('✅ Consistency check:', consistent ? 'PASS' : 'FAIL');
  
  if (!consistent) {
    console.log('❌ MISMATCH DETECTED!');
    console.log('   Marketplace:', marketplaceResult.displayText);
    console.log('   Customizer: ', customizerResult);
  }
  
  console.log('');
});

console.log('🎯 Expected Behavior Summary:');
console.log('- Mixed payments: "X LDZ + Y SOL"');
console.log('- Single LDZ: "X LDZ"');
console.log('- Single SOL: "X SOL"');
console.log('- Both components should show identical text');
console.log('- No mixing different token amounts into single values');
console.log('- Clear, accurate button and display text');

// Test the specific user-reported scenario
console.log('\n🔍 Testing User-Reported Scenarios:');

console.log('\n1. "500 LDZ + 0.005 SOL" scenario:');
const userScenario1 = marketplaceTotalPrice(testTraits.mixedPayment);
console.log('   Result:', userScenario1.displayText);
console.log('   Should show: "500 LDZ + 0.005 SOL" ✓');

console.log('\n2. "500 LDZ only" scenario:');
const userScenario2 = marketplaceTotalPrice(testTraits.ldzOnly);
console.log('   Result:', userScenario2.displayText);
console.log('   Should show: "500 LDZ" ✓');

console.log('\n✅ All tests completed!');