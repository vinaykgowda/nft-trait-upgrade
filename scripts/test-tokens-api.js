#!/usr/bin/env node

console.log('🔍 Testing Tokens API Response');
console.log('===============================\n');

// Simulate the API logic
const mockProjectTokens = [
  {
    id: '572d702d-4465-4cfc-b42a-...',
    token_address: 'E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK',
    token_name: 'Voodoo',
    token_symbol: 'LDZ',
    decimals: 6,
    enabled: true
  },
  {
    id: '96097029-40d1-4e1a-81e-...',
    token_address: 'So11111111111111111111111111111111111111112',
    token_name: 'Solana',
    token_symbol: 'SOL',
    decimals: 9,
    enabled: true
  }
];

const mockMainTokens = [
  {
    id: 'f3020eb2-582e-45f0-a5d0-7df47c87b79b',
    symbol: 'SOL',
    mint_address: null,
    decimals: 9,
    enabled: true
  }
];

console.log('📊 MOCK DATA:');
console.log('Project Tokens:', mockProjectTokens.length);
console.log('Main Tokens:', mockMainTokens.length);
console.log('');

// Simulate API logic
const tokens = [];

// Add project tokens FIRST
mockProjectTokens.forEach((row) => {
  tokens.push({
    id: row.id,
    tokenAddress: row.token_address,
    tokenName: row.token_name,
    tokenSymbol: row.token_symbol,
    decimals: row.decimals,
    enabled: row.enabled,
    source: 'project_tokens'
  });
});

// Add main tokens (avoid duplicates)
mockMainTokens.forEach((row) => {
  const existingToken = tokens.find(t => t.tokenSymbol === row.symbol);
  if (!existingToken) {
    tokens.push({
      id: row.id,
      tokenAddress: row.mint_address || 'So11111111111111111111111111111111111111112',
      tokenName: row.symbol === 'SOL' ? 'Solana' : row.symbol,
      tokenSymbol: row.symbol,
      decimals: row.decimals,
      enabled: row.enabled,
      source: 'main_tokens'
    });
  } else {
    console.log(`⚠️ Skipping duplicate token: ${row.symbol} (already exists from project_tokens)`);
  }
});

console.log('🎯 FINAL API RESPONSE:');
console.log(`Total tokens: ${tokens.length}`);
console.log('');

tokens.forEach((token, index) => {
  console.log(`${index + 1}. ${token.tokenSymbol} - ${token.tokenName}`);
  console.log(`   - ID: ${token.id}`);
  console.log(`   - Address: ${token.tokenAddress}`);
  console.log(`   - Decimals: ${token.decimals}`);
  console.log(`   - Source: ${token.source}`);
  console.log('');
});

console.log('✅ Expected dropdown options:');
tokens.forEach((token) => {
  console.log(`   - ${token.tokenSymbol} - ${token.tokenName}`);
});

console.log('\n🚀 This should now show both SOL and LDZ in the traits manager!');