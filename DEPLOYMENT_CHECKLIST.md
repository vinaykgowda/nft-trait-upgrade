# Deployment Checklist - Security Fixes

## Pre-Deployment

- [ ] All code changes committed to Git
- [ ] Local build passes: `npm run build`
- [ ] No TypeScript errors: `npm run lint`
- [ ] Neon DB connection string available
- [ ] Vercel project connected to Git repo

---

## Database Migration (Choose One Method)

### Method 1: Automated Script (Recommended) ⭐

```bash
# Set your Neon DB connection string
export DATABASE_URL="postgresql://[user]:[password]@[host]/[database]?sslmode=require"

# Run migration
npm run db:migrate:security
```

**Expected Output:**
```
🔒 Security Fixes Migration for Neon DB
==========================================

📡 Testing database connection...
✅ Connected to database

📄 Migration file loaded

🔍 Checking if migration already applied...
🔍 Checking for duplicate reservations...
✅ No duplicate reservations found

🔄 Running migration...
✅ Migration executed successfully!

🔍 Verifying changes...
  ✓ Constraint: unique_active_reservation
  ✓ Column: purchases.reservation_id
  ✓ Indexes: 2 performance indexes created

🎉 Migration completed successfully!
```

- [ ] Migration script ran successfully
- [ ] All checks passed (✓)

### Method 2: Neon SQL Editor (Manual)

1. Go to [Neon Console](https://console.neon.tech/)
2. Select your project
3. Click **SQL Editor**
4. Copy contents of `database/migrations/001_add_security_fixes.sql`
5. Paste and click **Run**

- [ ] SQL executed without errors
- [ ] Constraint created
- [ ] Column added
- [ ] Indexes created

### Method 3: psql CLI

```bash
psql "postgresql://[user]:[password]@[host]/[database]?sslmode=require" \
  -f database/migrations/001_add_security_fixes.sql
```

- [ ] Migration completed
- [ ] No errors in output

---

## Verify Database Changes

Run these queries in Neon SQL Editor:

```sql
-- Should return 1 row
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'inventory_reservations' 
AND constraint_name = 'unique_active_reservation';

-- Should return 1 row
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'purchases' AND column_name = 'reservation_id';

-- Should return 0 rows (no duplicates)
SELECT wallet_address, asset_id, trait_id, COUNT(*) 
FROM inventory_reservations 
WHERE status = 'reserved'
GROUP BY wallet_address, asset_id, trait_id 
HAVING COUNT(*) > 1;
```

- [ ] Constraint exists
- [ ] Column exists
- [ ] No duplicate reservations

---

## Deploy Code to Vercel

### Automatic Deployment

```bash
git add .
git commit -m "fix: security fixes for payment validation and multi-trait purchases"
git push origin main
```

- [ ] Code pushed to Git
- [ ] Vercel detected push
- [ ] Build started

### Monitor Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Watch deployment progress

- [ ] Build completed successfully
- [ ] Deployment status: "Ready"
- [ ] No build errors

---

## Post-Deployment Verification

### 1. Check Application Loads

```bash
# Visit your production URL
curl https://your-app.vercel.app

# Or visit in browser
```

- [ ] Application loads without errors
- [ ] No 500 errors
- [ ] Homepage renders correctly

### 2. Check Vercel Logs

```bash
vercel logs --prod
```

Look for these messages:
- [ ] ✅ "Delegate keypair and UMI signer initialized"
- [ ] ✅ "Payment instructions (derived from DB)"
- [ ] No critical errors

### 3. Test Basic Functionality

**Single Trait Purchase:**
1. Connect wallet
2. Select an NFT
3. Choose a trait
4. Click "Reserve"
5. Complete purchase

- [ ] Reservation created successfully
- [ ] Payment transaction built
- [ ] Transaction confirmed
- [ ] Inventory decremented

**Multi-Trait Purchase:**
1. Connect wallet
2. Select an NFT
3. Choose 2+ traits
4. Click "Reserve"
5. Complete purchase

- [ ] All traits reserved
- [ ] Single payment transaction
- [ ] All traits' inventory decremented
- [ ] All purchase records created

### 4. Test Concurrent Purchases

Have 2 people (or use 2 browsers):
1. Both try to buy the same trait
2. Both should succeed (if inventory available)

- [ ] Both purchases succeed
- [ ] No constraint violations
- [ ] Inventory correctly decremented

### 5. Test Payment Validation

Check Vercel logs for:
- [ ] "Payment instructions (derived from DB)" appears
- [ ] No "Client payment amount mismatch" warnings (unless testing)

---

## Monitoring (First 24 Hours)

### Vercel Logs

```bash
# Watch logs in real-time
vercel logs --prod --follow
```

**Good Signs:**
- ✅ "Payment instructions (derived from DB)"
- ✅ "Reserved traits: [...]"
- ✅ "Transaction confirmed: ..."

**Warning Signs (Expected):**
- ⚠️ "Client payment amount mismatch" - blocked manipulation attempt
- ⚠️ "Transaction timeout with signature" - slow confirmation (being monitored)

**Bad Signs (Investigate):**
- ❌ "Constraint violation"
- ❌ "Failed to consume reservation"
- ❌ "Transaction failed" repeatedly

- [ ] No critical errors in first hour
- [ ] Purchases completing successfully
- [ ] No overselling reports

### Neon DB Monitoring

1. Go to Neon Console → Monitoring
2. Check metrics

- [ ] Query performance normal
- [ ] Connection count stable
- [ ] No error spikes

---

## Rollback Plan (If Needed)

### If Application Issues

**Option 1: Vercel Dashboard**
1. Go to Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

**Option 2: Git Revert**
```bash
git revert HEAD
git push origin main
```

- [ ] Previous version deployed
- [ ] Application working

### If Database Issues (ONLY IF CRITICAL)

```sql
-- Rollback migration
ALTER TABLE inventory_reservations DROP CONSTRAINT unique_active_reservation;
ALTER TABLE purchases DROP COLUMN reservation_id;
```

⚠️ **WARNING**: Only rollback database if absolutely necessary. These fixes address security vulnerabilities.

---

## Success Criteria

- [x] Database migration completed
- [x] Vercel deployment successful
- [x] Application loads correctly
- [x] Single-trait purchases work
- [x] Multi-trait purchases work
- [x] No overselling under concurrent load
- [x] Payment amounts derived from database
- [x] No critical errors in logs
- [x] Performance acceptable

---

## Communication

### Team Notification

Send this message to your team:

```
🎉 Security Fixes Deployed

We've deployed critical security fixes for the NFT marketplace:

✅ Payment validation - Server now validates all payment amounts
✅ Multi-trait support - Buy multiple traits in one transaction
✅ Race condition prevention - No more overselling under load
✅ Timeout handling - Better handling of slow transactions

What's new:
- You can now purchase multiple traits in a single transaction
- All payment amounts are validated server-side
- Improved inventory management under concurrent load

Please report any issues immediately.

Docs: See SECURITY_FIXES_SUMMARY.md for details
```

- [ ] Team notified
- [ ] Documentation shared

---

## Timeline

- **Database Migration**: 5 minutes
- **Code Deployment**: 2-5 minutes (automatic)
- **Verification**: 10 minutes
- **Monitoring**: 24 hours

**Total Active Time**: ~20 minutes  
**Recommended**: Deploy during low-traffic period

---

## Completion

Date deployed: _______________  
Deployed by: _______________  
Issues encountered: _______________  
Resolution: _______________

**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back

---

## Notes

_Add any deployment notes, issues, or observations here:_

---

## Sign-Off

- [ ] Database migration verified
- [ ] Code deployment verified
- [ ] Functionality tested
- [ ] Monitoring in place
- [ ] Team notified
- [ ] Documentation updated

**Deployment Complete!** 🎉
