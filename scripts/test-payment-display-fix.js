#!/usr/bin/env node

/**
 * Test script to verify the payment calculation fix
 * This simulates the getTotalPrice() function logic
 */

// Mock trait data to test different scenarios
const testScenarios = [
  {
    name: "Mixed payment (500 LDZ + 0.005 SOL)",
    traits: [
      { name: "Trait 1", priceAmount: 500, priceToken: { symbol: 'LDZ' } },
      { name: "Trait 2", priceAmount: 0.005, priceToken: { symbol: 'SOL' } }
    ]
  },
  {
    name: "Single LDZ payment (500 LDZ)",
    traits: [
      { name: "Trait 1", priceAmount: 500, priceToken: { symbol: 'LDZ' } }
    ]
  },
  {
    name: "Single SOL payment (0.1 SOL)",
    traits: [
      { name: "Trait 1", priceAmount: 0.1, priceToken: { symbol: 'SOL' } }
    ]
  },
  {
    name: "Multiple LDZ traits (300 + 200 LDZ)",
    traits: [
      { name: "Trait 1", priceAmount: 300, priceToken: { symbol: 'LDZ' } },
      { name: "Trait 2", priceAmount: 200, priceToken: { symbol: 'LDZ' } }
    ]
  },
  {
    name: "Multiple mixed traits (100 LDZ + 200 LDZ + 0.01 SOL + 0.02 SOL)",
    traits: [
      { name: "Trait 1", priceAmount: 100, priceToken: { symbol: 'LDZ' } },
      { name: "Trait 2", priceAmount: 200, priceToken: { symbol: 'LDZ' } },
      { name: "Trait 3", priceAmount: 0.01, priceToken: { symbol: 'SOL' } },
      { name: "Trait 4", priceAmount: 0.02, priceToken: { symbol: 'SOL' } }
    ]
  }
];

// Simulate the fixed getTotalPrice function
function getTotalPrice(traits) {
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

  console.log('  Calculation details:', { 
    solTotal, 
    ldzTotal, 
    traits: traits.map(t => ({ 
      name: t.name, 
      amount: t.priceAmount, 
      token: t.priceToken.symbol 
    })) 
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

console.log('🧪 Testing Payment Display Fix\n');

testScenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.name}`);
  
  const result = getTotalPrice(scenario.traits);
  
  console.log('  Result:', {
    displayText: result.displayText,
    isMixed: result.isMixed,
    ...(result.isMixed ? {
      ldzAmount: result.ldzAmount,
      solAmount: result.solAmount
    } : {
      amount: result.amount,
      symbol: result.symbol
    })
  });
  
  console.log('  Button text would show: "Update NFT -', result.displayText + '"');
  console.log('  Total display would show:', result.displayText);
  console.log('');
});

console.log('✅ All test scenarios completed');
console.log('\n📝 Expected behavior:');
console.log('- Mixed payments should show "X LDZ + Y SOL"');
console.log('- Single token payments should show "X TOKEN"');
console.log('- No mixing of different token amounts into single values');
console.log('- Button text should be clear and accurate');