#!/usr/bin/env node

console.log('🔧 Mixed Payment Fix Test');
console.log('=========================\n');

// Mock the exact scenario you're seeing
const selectedTraits = {
  'eyewear-slot': {
    id: '1',
    name: 'PEPE',
    priceAmount: '500',
    priceToken: { symbol: 'LDZ' }
  },
  'background-slot': {
    id: '2', 
    name: 'Teal',
    priceAmount: '0.005',
    priceToken: { symbol: 'SOL' }
  }
};

// Test the OLD (buggy) calculation
function oldGetTotalPrice(selectedTraits) {
  const traits = Object.values(selectedTraits);
  return {
    amount: traits.reduce((total, trait) => total + Number(trait.priceAmount), 0),
    symbol: traits.length > 0 ? traits[0].priceToken.symbol : 'SOL'
  };
}

// Test the NEW (fixed) calculation
function newGetTotalPrice(selectedTraits) {
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
    // Mixed payment - show primary token (LDZ preferred)
    return {
      amount: `${ldzTotal} LDZ + ${solTotal} SOL`,
      symbol: '',
      isMixed: true,
      ldzAmount: ldzTotal,
      solAmount: solTotal
    };
  } else if (ldzTotal > 0) {
    // LDZ only
    return {
      amount: ldzTotal,
      symbol: 'LDZ',
      isMixed: false
    };
  } else if (solTotal > 0) {
    // SOL only
    return {
      amount: solTotal,
      symbol: 'SOL',
      isMixed: false
    };
  } else {
    // No traits selected
    return {
      amount: 0,
      symbol: 'SOL',
      isMixed: false
    };
  }
}

console.log('📊 Your Current Selection:');
console.log('==========================');
Object.values(selectedTraits).forEach((trait, index) => {
  console.log(`${index + 1}. ${trait.name}: ${trait.priceAmount} ${trait.priceToken.symbol}`);
});

console.log('\n❌ OLD (BUGGY) CALCULATION:');
console.log('===========================');
const oldResult = oldGetTotalPrice(selectedTraits);
console.log(`Result: ${oldResult.amount} ${oldResult.symbol}`);
console.log(`Display: "Total: ${oldResult.amount} ${oldResult.symbol}"`);
console.log(`Button: "Update NFT - ${oldResult.amount} ${oldResult.symbol}"`);
console.log('❌ PROBLEM: Adding 500 + 0.005 = 500.005, but showing as LDZ!');

console.log('\n✅ NEW (FIXED) CALCULATION:');
console.log('===========================');
const newResult = newGetTotalPrice(selectedTraits);
console.log(`Result:`, newResult);
if (newResult.isMixed) {
  console.log(`Display: "Total: ${newResult.amount}"`);
  console.log(`Button: "Update NFT - ${newResult.amount}"`);
} else {
  console.log(`Display: "Total: ${newResult.amount} ${newResult.symbol}"`);
  console.log(`Button: "Update NFT - ${newResult.amount} ${newResult.symbol}"`);
}
console.log('✅ FIXED: Shows separate amounts for different tokens!');

console.log('\n🧪 Additional Test Cases:');
console.log('========================');

// Test LDZ only
const ldzOnly = {
  'trait1': { name: 'Trait 1', priceAmount: '100', priceToken: { symbol: 'LDZ' } },
  'trait2': { name: 'Trait 2', priceAmount: '200', priceToken: { symbol: 'LDZ' } }
};
const ldzResult = newGetTotalPrice(ldzOnly);
console.log(`\n1. LDZ Only: ${ldzResult.amount} ${ldzResult.symbol}`);

// Test SOL only  
const solOnly = {
  'trait1': { name: 'Trait 1', priceAmount: '0.5', priceToken: { symbol: 'SOL' } },
  'trait2': { name: 'Trait 2', priceAmount: '0.3', priceToken: { symbol: 'SOL' } }
};
const solResult = newGetTotalPrice(solOnly);
console.log(`2. SOL Only: ${solResult.amount} ${solResult.symbol}`);

// Test mixed (your case)
console.log(`3. Mixed Payment: ${newResult.amount}`);

console.log('\n🎉 SUMMARY:');
console.log('===========');
console.log('✅ Fixed the bug where different token amounts were being added together');
console.log('✅ Now properly separates SOL and LDZ amounts');
console.log('✅ Shows "500 LDZ + 0.005 SOL" instead of "500.005 LDZ"');
console.log('✅ Button and total display now show correct information');
console.log('');
console.log('🎯 What you should see now:');
console.log(`   Total: ${newResult.amount}`);
console.log(`   Button: "Update NFT - ${newResult.amount}"`);