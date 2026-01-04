#!/usr/bin/env node

console.log('🔧 Running Token Migration');
console.log('==========================\n');

const https = require('https');

const migrationUrl = 'https://pepenftupgrade.vercel.app/api/admin/migrate-tokens';

const postData = JSON.stringify({});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'x-migration-key': process.env.MIGRATION_SECRET || 'dev-migration-key'
  }
};

console.log('🚀 Sending migration request to:', migrationUrl);

const req = https.request(migrationUrl, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📊 Response Status:', res.statusCode);
    console.log('📊 Response Headers:', res.headers);
    
    try {
      const response = JSON.parse(data);
      console.log('\n📋 Migration Result:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.success) {
        console.log('\n✅ Migration completed successfully!');
        console.log('🎯 Traits can now use both SOL and LDZ tokens');
      } else {
        console.log('\n❌ Migration failed:', response.error);
      }
    } catch (error) {
      console.log('\n❌ Failed to parse response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
});

req.write(postData);
req.end();