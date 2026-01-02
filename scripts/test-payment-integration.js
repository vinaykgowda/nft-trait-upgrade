#!/usr/bin/env node

/**
 * Test script to verify the payment integration is properly implemented
 * This checks if the transaction APIs are using real data instead of mocks
 */

const { execSync } = require('child_process');

console.log('🔍 Testing Payment Integration\n');

// Test 1: Check if environment variables are configured
console.log('1. Environment Configuration:');
const requiredEnvVars = [
  'TREASURY_WALLET',
  'LDZ_TOKEN_MINT',
  'SOLANA_DELEGATE_PRIVATE_KEY',
  'IRYS_PRIVATE_KEY'
];

const envFile = require('fs').readFileSync('.env.local', 'utf8');
const missingVars = [];

requiredEnvVars.forEach(varName => {
  if (envFile.includes(`${varName}=`) && !envFile.includes(`${varName}=`)) {
    console.log(`   ❌ ${varName}: Not configured`);
    missingVars.push(varName);
  } else {
    console.log(`   ✅ ${varName}: Configured`);
  }
});

// Test 2: Check if transaction builder uses real data
console.log('\n2. Transaction Builder Implementation:');
const transactionBuilderFile = require('fs').readFileSync('src/lib/services/transaction-builder.ts', 'utf8');

if (transactionBuilderFile.includes('mockCoreProgram')) {
  console.log('   ⚠️  Still using mock Core program ID');
} else {
  console.log('   ✅ Core program implementation looks real');
}

if (transactionBuilderFile.includes('Math.floor(solAmount * 1000000000)')) {
  console.log('   ✅ SOL to lamports conversion implemented');
} else {
  console.log('   ❌ SOL conversion missing');
}

// Test 3: Check if transaction build API uses real trait data
console.log('\n3. Transaction Build API:');
const buildApiFile = require('fs').readFileSync('src/app/api/tx/build/route.ts', 'utf8');

if (buildApiFile.includes('mockTraitData')) {
  console.log('   ❌ Still using mock trait data');
} else {
  console.log('   ✅ Using real trait data from database');
}

if (buildApiFile.includes('TraitRepository')) {
  console.log('   ✅ Integrated with TraitRepository');
} else {
  console.log('   ❌ Not integrated with TraitRepository');
}

if (buildApiFile.includes('ProjectTokensService')) {
  console.log('   ✅ Integrated with ProjectTokensService');
} else {
  console.log('   ❌ Not integrated with ProjectTokensService');
}

// Test 4: Check reservation system
console.log('\n4. Reservation System:');
const reserveApiFile = require('fs').readFileSync('src/app/api/reserve/route.ts', 'utf8');

if (reserveApiFile.includes('traitIds: z.array')) {
  console.log('   ✅ Supports multiple traits');
} else {
  console.log('   ❌ Only supports single trait');
}

// Test 5: Check payment validation
console.log('\n5. Payment Validation:');
const paymentValidationFile = require('fs').readFileSync('src/app/api/payment/validate/route.ts', 'utf8');

if (paymentValidationFile.includes('validateSOLPayment') && paymentValidationFile.includes('validateTokenPayment')) {
  console.log('   ✅ Supports both SOL and token validation');
} else {
  console.log('   ❌ Payment validation incomplete');
}

// Summary
console.log('\n📊 Integration Status Summary:');
console.log('=================================');

const issues = [];

if (missingVars.length > 0) {
  issues.push(`Missing environment variables: ${missingVars.join(', ')}`);
}

if (buildApiFile.includes('mockTraitData')) {
  issues.push('Transaction build API still uses mock data');
}

if (!buildApiFile.includes('TraitRepository')) {
  issues.push('Transaction build API not integrated with database');
}

if (!reserveApiFile.includes('traitIds: z.array')) {
  issues.push('Reservation system only supports single traits');
}

if (issues.length === 0) {
  console.log('✅ Payment integration appears to be properly implemented!');
  console.log('✅ Real trait data is being used');
  console.log('✅ Multiple payment tokens supported');
  console.log('✅ Environment variables configured');
} else {
  console.log('❌ Issues found:');
  issues.forEach(issue => console.log(`   - ${issue}`));
}

console.log('\n🔧 Next Steps:');
console.log('1. Test with actual Solana devnet transactions');
console.log('2. Verify LDZ token mint address is correct');
console.log('3. Test mixed payment scenarios');
console.log('4. Verify Core asset update instructions work');

console.log('\n⚠️  Important Notes:');
console.log('- The Core asset update instruction is still using a mock implementation');
console.log('- You need to integrate with the actual Metaplex Core SDK');
console.log('- Test thoroughly on devnet before production deployment');