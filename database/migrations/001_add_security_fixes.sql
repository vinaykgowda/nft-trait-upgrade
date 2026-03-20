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

-- 3. Add 'pending' status for timeout handling
-- (Already handled in type definition, no schema change needed)

-- 4. Create index for faster reservation lookups
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_expires 
ON inventory_reservations(status, expires_at);

-- 5. Create index for purchase status queries
CREATE INDEX IF NOT EXISTS idx_purchases_status_created 
ON purchases(status, created_at);

-- 6. Add comment explaining the security fixes
COMMENT ON CONSTRAINT unique_active_reservation ON inventory_reservations IS 
'Prevents duplicate reservations by the same wallet for the same asset+trait combination. Multiple users CAN reserve the same trait (different wallets/assets).';

COMMENT ON COLUMN purchases.reservation_id IS 
'Links purchase to reservation for multi-trait purchase tracking and audit trail';
