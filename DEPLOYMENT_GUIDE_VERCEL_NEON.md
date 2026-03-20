# Deployment Guide - Vercel + Neon DB

## Overview
This guide covers deploying the security fixes to your Vercel + Neon DB setup.

---

## Prerequisites

- [ ] Neon DB connection string (from Neon dashboard)
- [ ] Vercel project connected to your Git repo
- [ ] `psql` or Neon SQL Editor access

---

## Step 1: Run Database Migration on Neon DB

You have **3 options** to run the migration:

### Option A: Using Neon SQL Editor (Easiest) ⭐

1. Go to [Neon Console](https://console.neon.tech/)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Copy and paste the migration script below
5. Click **Run**

```sql
-- Migration: Security Fixes for Payment Validation, Multi-Trait, Race Conditions, and Timeout Issues
-- Date: 2026-03-20

-- 1. Add unique constraint to prevent duplicate active reservations (fixes race condition)
-- NOTE: This constraint is per wallet+asset+trait, allowing multiple people to buy the same trait
ALTER TABLE inventory_reservations 
ADD CONSTRAINT unique_active_reservation 
UNIQUE (wallet_address, asset_id, trait_id, status);

-- 2. Add reservation_id to purchases table (fixes multi-trait tracking)
ALTER TABLE purchases 
ADD COLUMN reservation_id UUID REFERENCES inventory_reservations(id);

-- 3. Create index for faster reservation lookups
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_expires 
ON inventory_reservations(status, expires_at);

-- 4. Create index for purchase status queries
CREATE INDEX IF NOT EXISTS idx_purchases_status_created 
ON purchases(status, created_at);

-- 5. Add comments explaining the security fixes
COMMENT ON CONSTRAINT unique_active_reservation ON inventory_reservations IS 
'Prevents duplicate reservations by the same wallet for the same asset+trait combination. Multiple users CAN reserve the same trait (different wallets/assets).';

COMMENT ON COLUMN purchases.reservation_id IS 
'Links purchase to reservation for multi-trait purchase tracking and audit trail';
```

### Option B: Using psql CLI

1. Get your Neon connection string from the dashboard
2. Run the migration:

```bash
# Connect to Neon DB
psql "postgresql://[user]:[password]@[host]/[database]?sslmode=require"

# Run migration
\i database/migrations/001_add_security_fixes.sql

# Verify changes
\d inventory_reservations
\d purchases

# Exit
\q
```

### Option C: Using Node.js Script (Automated)

Create a migration script:

```bash
# Create migration runner
cat > scripts/run-migration.js << 'EOF'
const { Pool } = require('pg');
const fs = require('fs');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const migrationSQL = fs.readFileSync('database/migrations/001_add_security_fixes.sql', 'utf8');
    
    console.log('🔄 Running migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    
    // Verify
    const result = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'inventory_reservations' 
      AND constraint_name = 'unique_active_reservation'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Constraint verified: unique_active_reservation');
    } else {
      console.error('❌ Constraint not found!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
EOF

# Run it
node scripts/run-migration.js
```

---

## Step 2: Verify Migration Success

Run these queries in Neon SQL Editor to verify:

```sql
-- Check constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'inventory_reservations' 
AND constraint_name = 'unique_active_reservation';
-- Expected: 1 row with constraint_type = 'UNIQUE'

-- Check new column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchases' 
AND column_name = 'reservation_id';
-- Expected: 1 row with data_type = 'uuid'

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('inventory_reservations', 'purchases')
AND indexname IN ('idx_inventory_reservations_status_expires', 'idx_purchases_status_created');
-- Expected: 2 rows

-- Check for any existing data conflicts (should be empty)
SELECT wallet_address, asset_id, trait_id, COUNT(*) 
FROM inventory_reservations 
WHERE status = 'reserved'
GROUP BY wallet_address, asset_id, trait_id 
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)
```

---

## Step 3: Deploy Code to Vercel

### Automatic Deployment (Recommended)

```bash
# Commit and push changes
git add .
git commit -m "fix: security fixes for payment validation, multi-trait, race conditions, and timeouts"
git push origin main
```

Vercel will automatically:
1. Detect the push
2. Build your application
3. Deploy to production

### Manual Deployment (Alternative)

```bash
# Using Vercel CLI
vercel --prod
```

---

## Step 4: Verify Deployment

### Check Vercel Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Check latest deployment status
4. Look for "Ready" status
5. Click "Visit" to test

### Check Application Logs

```bash
# Using Vercel CLI
vercel logs --prod

# Look for these messages:
# ✅ "Payment instructions (derived from DB)"
# ✅ "Reserved traits: [uuid1, uuid2]"
# ✅ "Delegate keypair and UMI signer initialized"
```

### Test Basic Functionality

1. Visit your production URL
2. Connect wallet
3. Try to reserve a trait
4. Check browser console for errors
5. Verify reservation created successfully

---

## Step 5: Monitor for Issues

### First 24 Hours

Watch for these in Vercel logs:

```bash
# Good signs:
✅ "Payment instructions (derived from DB)" - payment validation working
✅ "Reserved traits: [...]" - multi-trait working
✅ "Transaction confirmed: ..." - purchases completing

# Warning signs (expected, not errors):
⚠️ "Client payment amount mismatch" - client tried to manipulate amount (blocked)
⚠️ "Transaction timeout with signature" - slow confirmation (being monitored)

# Bad signs (investigate):
❌ "Constraint violation" - should not happen with new constraint
❌ "Failed to consume reservation" - check inventory logic
❌ "Transaction failed" - check Solana RPC connection
```

### Neon DB Monitoring

1. Go to Neon Console → Monitoring
2. Check:
   - Query performance (should be similar to before)
   - Connection count (should be stable)
   - Error rate (should be low)

---

## Rollback Plan (If Needed)

### If Application Issues

```bash
# Revert to previous deployment in Vercel Dashboard
# OR
git revert HEAD
git push origin main
```

### If Database Issues

```sql
-- Rollback migration (only if absolutely necessary)

-- Remove constraint
ALTER TABLE inventory_reservations 
DROP CONSTRAINT IF EXISTS unique_active_reservation;

-- Remove column
ALTER TABLE purchases 
DROP COLUMN IF EXISTS reservation_id;

-- Remove indexes
DROP INDEX IF EXISTS idx_inventory_reservations_status_expires;
DROP INDEX IF EXISTS idx_purchases_status_created;
```

**⚠️ WARNING**: Only rollback database if critical issues occur. The fixes address security vulnerabilities.

---

## Environment Variables Check

Verify these are set in Vercel:

```bash
# Required
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
SOLANA_RPC_URL=https://...
SOLANA_DELEGATE_PRIVATE_KEY=[your-key]

# Optional but recommended
NODE_ENV=production
```

To check/update:
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify all required variables are set
3. Redeploy if you make changes

---

## Testing Checklist

After deployment, test these scenarios:

### Single Trait Purchase (Existing Flow)
- [ ] Reserve single trait
- [ ] Complete payment
- [ ] Verify inventory decremented
- [ ] Check purchase record created

### Multi-Trait Purchase (New Flow)
- [ ] Reserve 2+ traits
- [ ] Complete single payment transaction
- [ ] Verify all traits' inventory decremented
- [ ] Check all purchase records created

### Concurrent Purchases
- [ ] Have 2 friends try to buy same trait simultaneously
- [ ] Both should succeed (if inventory available)
- [ ] Verify no overselling

### Payment Validation
- [ ] Check Vercel logs for "Payment instructions (derived from DB)"
- [ ] Verify payment amounts match database prices
- [ ] No client manipulation possible

---

## Common Issues & Solutions

### Issue: "Constraint already exists"
**Solution**: Constraint was already added. Safe to ignore or use `IF NOT EXISTS`:
```sql
ALTER TABLE inventory_reservations 
ADD CONSTRAINT IF NOT EXISTS unique_active_reservation 
UNIQUE (wallet_address, asset_id, trait_id, status);
```

### Issue: "Column already exists"
**Solution**: Column was already added. Safe to ignore or use `IF NOT EXISTS`:
```sql
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES inventory_reservations(id);
```

### Issue: "Duplicate key value violates unique constraint"
**Cause**: Existing duplicate reservations in database  
**Solution**: Clean up duplicates before adding constraint:
```sql
-- Find duplicates
SELECT wallet_address, asset_id, trait_id, status, COUNT(*) 
FROM inventory_reservations 
GROUP BY wallet_address, asset_id, trait_id, status 
HAVING COUNT(*) > 1;

-- Mark older duplicates as cancelled
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
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now add constraint
ALTER TABLE inventory_reservations 
ADD CONSTRAINT unique_active_reservation 
UNIQUE (wallet_address, asset_id, trait_id, status);
```

### Issue: Vercel build fails
**Cause**: TypeScript errors or missing dependencies  
**Solution**: 
```bash
# Test build locally first
npm run build

# Check for errors
npm run type-check

# If successful, push again
git push origin main
```

### Issue: Database connection timeout
**Cause**: Neon DB connection limit or network issue  
**Solution**:
1. Check Neon DB status in console
2. Verify DATABASE_URL in Vercel env vars
3. Check connection pooling settings

---

## Performance Impact

Expected changes after deployment:

- **Reservation creation**: +10-50ms (row-level locking)
- **Multi-trait purchases**: Linear with trait count
- **Database queries**: Minimal impact (indexes added)
- **Overall**: No noticeable user-facing slowdown

---

## Success Criteria

✅ Migration runs without errors  
✅ Vercel deployment succeeds  
✅ Application loads correctly  
✅ Single-trait purchases work  
✅ Multi-trait purchases work  
✅ No overselling under concurrent load  
✅ Payment amounts derived from database  
✅ No critical errors in logs  

---

## Support

If you encounter issues:

1. **Check Vercel logs**: `vercel logs --prod`
2. **Check Neon DB logs**: Neon Console → Monitoring
3. **Review error messages**: Look for specific constraint/column errors
4. **Test locally**: Ensure changes work in development first
5. **Rollback if needed**: Use rollback plan above

---

## Quick Command Reference

```bash
# Deploy to Vercel
git push origin main

# Check Vercel logs
vercel logs --prod

# Connect to Neon DB
psql "postgresql://[user]:[password]@[host]/[database]?sslmode=require"

# Run migration
\i database/migrations/001_add_security_fixes.sql

# Verify deployment
curl https://your-app.vercel.app/api/health
```

---

## Next Steps After Deployment

1. Monitor logs for 24 hours
2. Test multi-trait purchases
3. Verify no overselling occurs
4. Check payment validation working
5. Review transaction timeout handling
6. Update team on new features
7. Document any issues encountered

---

## Timeline

- **Database Migration**: 5 minutes
- **Vercel Deployment**: 2-5 minutes (automatic)
- **Verification**: 10 minutes
- **Total**: ~20 minutes

**Recommended**: Deploy during low-traffic period to minimize impact.
