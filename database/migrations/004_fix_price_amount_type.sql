-- Migration: Fix price_amount to store decimal values instead of bigint
-- This allows storing prices like 0.005 SOL directly

-- Change price_amount from BIGINT to DECIMAL(20,9) to support up to 9 decimal places
ALTER TABLE traits ALTER COLUMN price_amount TYPE DECIMAL(20,9) USING price_amount::DECIMAL(20,9);

-- Update existing trait with proper decimal value
UPDATE traits SET price_amount = 0.005 WHERE price_amount = 5000000;