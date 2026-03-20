# Quick Deploy - 5 Minute Guide

## TL;DR - Just Do This

### 1. Run Migration on Neon DB (2 minutes)

Go to [Neon Console](https://console.neon.tech/) → SQL Editor → Paste this:

```sql
-- Add unique constraint
ALTER TABLE inventory_reservations 
ADD CONSTRAINT unique_active_reservation 
UNIQUE (wallet_address, asset_id, trait_id, status);

-- Add reservation_id column
ALTER TABLE purchases 
ADD COLUMN reservation_id UUID REFERENCES inventory_reservations(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_expires 
ON inventory_reservations(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_purchases_status_created 
ON purchases(status, created_at);
```

Click **Run**. Done! ✅

### 2. Deploy Code to Vercel (2 minutes)

```bash
git add .
git commit -m "fix: security fixes for payment validation and multi-trait purchases"
git push origin main
```

Vercel auto-deploys. Done! ✅

### 3. Verify (1 minute)

Check Vercel Dashboard → Latest deployment → "Ready" status

Test: Visit your site → Try to reserve a trait → Should work!

---

## That's It!

Total time: ~5 minutes

If anything fails, see `DEPLOYMENT_GUIDE_VERCEL_NEON.md` for detailed troubleshooting.

---

## What If I Get Errors?

### "Constraint already exists"
✅ Safe to ignore - already applied

### "Column already exists"  
✅ Safe to ignore - already applied

### "Duplicate key violation"
Run this first to clean up duplicates:

```sql
-- Mark duplicate reservations as cancelled
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
```

Then run the migration again.

### Vercel build fails
```bash
# Test locally first
npm run build

# If it works, push again
git push origin main
```

---

## Rollback (If Needed)

### Revert Code
```bash
git revert HEAD
git push origin main
```

### Revert Database
```sql
ALTER TABLE inventory_reservations DROP CONSTRAINT unique_active_reservation;
ALTER TABLE purchases DROP COLUMN reservation_id;
```

---

## Done!

Your security fixes are now live. 🎉

Monitor Vercel logs for the first hour to ensure everything works smoothly.
