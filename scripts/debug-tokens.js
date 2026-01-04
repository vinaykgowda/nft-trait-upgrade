const { query } = require('../src/lib/database.ts');

async function debugTokens() {
  try {
    console.log('🔍 Checking tokens in database...\n');

    // Check main tokens table
    const mainTokensResult = await query(`
      SELECT id, symbol, mint_address, decimals, enabled, created_at
      FROM tokens 
      ORDER BY symbol
    `);

    console.log('📊 MAIN TOKENS TABLE:');
    console.log(`Found ${mainTokensResult.rows.length} tokens`);
    mainTokensResult.rows.forEach((token, index) => {
      console.log(`${index + 1}. ${token.symbol} (${token.id})`);
      console.log(`   - Mint Address: ${token.mint_address || 'NULL'}`);
      console.log(`   - Decimals: ${token.decimals}`);
      console.log(`   - Enabled: ${token.enabled}`);
      console.log(`   - Created: ${token.created_at}`);
      console.log('');
    });

    // Check project tokens table
    const projectTokensResult = await query(`
      SELECT id, token_address, token_name, token_symbol, decimals, enabled, created_at
      FROM project_tokens 
      ORDER BY token_symbol
    `);

    console.log('📊 PROJECT TOKENS TABLE:');
    console.log(`Found ${projectTokensResult.rows.length} tokens`);
    projectTokensResult.rows.forEach((token, index) => {
      console.log(`${index + 1}. ${token.token_symbol} - ${token.token_name} (${token.id})`);
      console.log(`   - Token Address: ${token.token_address}`);
      console.log(`   - Decimals: ${token.decimals}`);
      console.log(`   - Enabled: ${token.enabled}`);
      console.log(`   - Created: ${token.created_at}`);
      console.log('');
    });

    // Check what the API would return
    const tokens = [];

    // Add main tokens
    mainTokensResult.rows.forEach((row) => {
      if (row.enabled) {
        tokens.push({
          id: row.id,
          tokenAddress: row.mint_address || 'So11111111111111111111111111111111111111112',
          tokenName: row.symbol === 'SOL' ? 'Solana' : row.symbol,
          tokenSymbol: row.symbol,
          decimals: row.decimals,
          enabled: row.enabled,
          source: 'main_tokens'
        });
      }
    });

    // Add project tokens (avoiding duplicates)
    projectTokensResult.rows.forEach((row) => {
      if (row.enabled) {
        const existingToken = tokens.find(t => t.tokenSymbol === row.token_symbol);
        if (!existingToken) {
          tokens.push({
            id: row.id,
            tokenAddress: row.token_address,
            tokenName: row.token_name,
            tokenSymbol: row.token_symbol,
            decimals: row.decimals,
            enabled: row.enabled,
            source: 'project_tokens'
          });
        }
      }
    });

    console.log('🎯 FINAL API RESPONSE (enabled tokens only):');
    console.log(`Total tokens that would be returned: ${tokens.length}`);
    tokens.forEach((token, index) => {
      console.log(`${index + 1}. ${token.tokenSymbol} - ${token.tokenName}`);
      console.log(`   - ID: ${token.id}`);
      console.log(`   - Address: ${token.tokenAddress}`);
      console.log(`   - Decimals: ${token.decimals}`);
      console.log(`   - Source: ${token.source}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugTokens();