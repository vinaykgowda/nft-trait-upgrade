const argon2 = require('argon2');

async function createAdminHash() {
  const username = 'admin';
  const password = 'YourSecurePassword123!'; // Change this!
  
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
    
    console.log('Username:', username);
    console.log('Password Hash:', hash);
    console.log('\nSQL to run in Neon:');
    console.log(`INSERT INTO admin_users (username, password_hash, roles, created_at) VALUES ('${username}', '${hash}', ARRAY['admin'], NOW());`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminHash();