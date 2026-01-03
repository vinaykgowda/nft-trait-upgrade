const argon2 = require('argon2');

async function generateAdminUserSQL() {
  const username = 'vkg_mrpepe';
  const password = 'PepeGods@2407$!'; // Change this to your desired password
  
  try {
    console.log('Generating password hash...');
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
    
    console.log('\n=== ADMIN USER CREATION ===');
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('\n=== SQL TO RUN IN NEON ===');
    console.log(`INSERT INTO admin_users (username, password_hash, roles, created_at) VALUES ('${username}', '${hash}', ARRAY['admin'], NOW());`);
    console.log('\n=== VERIFICATION SQL ===');
    console.log('SELECT id, username, roles, created_at FROM admin_users;');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

generateAdminUserSQL();