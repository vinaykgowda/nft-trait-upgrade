#!/usr/bin/env node

/**
 * Neon DB Migration Script
 * 
 * Runs the security fixes migration on Neon DB
 * 
 * Usage:
 *   node scripts/migrate-neon.js
 * 
 * Or with custom connection string:
 *   DATABASE_URL="postgresql://..." node scripts/migrate-neon.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigration() {
  log('\n🔒 Security Fixes Migration for Neon DB', 'blue');
  log('==========================================\n', 'blue');

  // Check for DATABASE_URL
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    log('❌ ERROR: DATABASE_URL environment variable not set', 'red');
    log('\nPlease set it in your .env file or run:', 'yellow');
    log('  DATABASE_URL="postgresql://..." node scripts/migrate-neon.js\n', 'yellow');
    process.exit(1);
  }

  // Validate connection string
  if (!connectionString.includes('neon.tech') && !connectionString.includes('localhost')) {
    log('⚠️  WARNING: Connection string does not appear to be Neon DB', 'yellow');
    log('   Proceeding anyway...\n', 'yellow');
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    // Test connection
    log('📡 Testing database connection...', 'blue');
    await pool.query('SELECT NOW()');
    log('✅ Connected to database\n', 'green');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '001_add_security_fixes.sql');
    if (!fs.existsSync(migrationPath)) {
      log(`❌ Migration file not found: ${migrationPath}`, 'red');
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log('📄 Migration file loaded\n', 'blue');

    // Check if migration already applied
    log('🔍 Checking if migration already applied...', 'blue');
    const constraintCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'inventory_reservations' 
      AND constraint_name = 'unique_active_reservation'
    `);

    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'purchases' 
      AND column_name = 'reservation_id'
    `);

    if (constraintCheck.rows.length > 0 && columnCheck.rows.length > 0) {
      log('⚠️  Migration appears to already be applied', 'yellow');
      log('   Constraint: unique_active_reservation ✓', 'yellow');
      log('   Column: purchases.reservation_id ✓\n', 'yellow');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('Do you want to run it anyway? (y/N): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'y') {
        log('\n✅ Migration skipped (already applied)\n', 'green');
        process.exit(0);
      }
    }

    // Check for duplicate reservations before adding constraint
    log('🔍 Checking for duplicate reservations...', 'blue');
    const duplicates = await pool.query(`
      SELECT wallet_address, asset_id, trait_id, status, COUNT(*) as count
      FROM inventory_reservations 
      WHERE status = 'reserved'
      GROUP BY wallet_address, asset_id, trait_id, status 
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      log(`⚠️  Found ${duplicates.rows.length} duplicate reservation(s)`, 'yellow');
      log('   Cleaning up duplicates before adding constraint...\n', 'yellow');

      // Clean up duplicates
      await pool.query(`
        WITH duplicates AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY wallet_address, asset_id, trait_id, status 
            ORDER BY created_at DESC
          ) as rn
          FROM inventory_reservations
          WHERE status = 'reserved'
        )
        UPDATE inventory_reservations 
        SET status = 'cancelled'
        WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)
      `);

      log('✅ Duplicates cleaned up\n', 'green');
    } else {
      log('✅ No duplicate reservations found\n', 'green');
    }

    // Run migration
    log('🔄 Running migration...', 'blue');
    await pool.query(migrationSQL);
    log('✅ Migration executed successfully!\n', 'green');

    // Verify changes
    log('🔍 Verifying changes...', 'blue');

    const verifyConstraint = await pool.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'inventory_reservations' 
      AND constraint_name = 'unique_active_reservation'
    `);

    const verifyColumn = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'purchases' 
      AND column_name = 'reservation_id'
    `);

    const verifyIndexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('inventory_reservations', 'purchases')
      AND indexname IN ('idx_inventory_reservations_status_expires', 'idx_purchases_status_created')
    `);

    let allGood = true;

    if (verifyConstraint.rows.length > 0) {
      log('  ✓ Constraint: unique_active_reservation', 'green');
    } else {
      log('  ✗ Constraint: unique_active_reservation NOT FOUND', 'red');
      allGood = false;
    }

    if (verifyColumn.rows.length > 0) {
      log('  ✓ Column: purchases.reservation_id', 'green');
    } else {
      log('  ✗ Column: purchases.reservation_id NOT FOUND', 'red');
      allGood = false;
    }

    if (verifyIndexes.rows.length === 2) {
      log('  ✓ Indexes: 2 performance indexes created', 'green');
    } else {
      log(`  ⚠ Indexes: ${verifyIndexes.rows.length}/2 created`, 'yellow');
    }

    log('');

    if (allGood) {
      log('🎉 Migration completed successfully!', 'green');
      log('', 'reset');
      log('Next steps:', 'blue');
      log('  1. Deploy code to Vercel: git push origin main', 'reset');
      log('  2. Monitor Vercel logs for any issues', 'reset');
      log('  3. Test multi-trait purchases', 'reset');
      log('', 'reset');
    } else {
      log('⚠️  Migration completed with warnings', 'yellow');
      log('   Please review the output above\n', 'yellow');
    }

  } catch (error) {
    log('\n❌ Migration failed!', 'red');
    log(`   Error: ${error.message}\n`, 'red');

    if (error.message.includes('already exists')) {
      log('💡 This error usually means the migration was already applied.', 'yellow');
      log('   You can safely ignore this if the constraint/column already exists.\n', 'yellow');
    } else if (error.message.includes('duplicate key')) {
      log('💡 There are duplicate reservations in your database.', 'yellow');
      log('   Run this query to clean them up:', 'yellow');
      log('', 'reset');
      log('   WITH duplicates AS (', 'reset');
      log('     SELECT id, ROW_NUMBER() OVER (', 'reset');
      log('       PARTITION BY wallet_address, asset_id, trait_id, status', 'reset');
      log('       ORDER BY created_at DESC', 'reset');
      log('     ) as rn', 'reset');
      log('     FROM inventory_reservations', 'reset');
      log('     WHERE status = \'reserved\'', 'reset');
      log('   )', 'reset');
      log('   UPDATE inventory_reservations', 'reset');
      log('   SET status = \'cancelled\'', 'reset');
      log('   WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);', 'reset');
      log('', 'reset');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}\n`, 'red');
  process.exit(1);
});
