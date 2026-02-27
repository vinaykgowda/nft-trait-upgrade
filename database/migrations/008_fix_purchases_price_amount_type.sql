-- Migration: Fix purchases.price_amount from BIGINT to NUMERIC(20,9)
-- Root cause: traits.price_amount is NUMERIC(20,9) storing values like 0.001 SOL or 100 LDZ
-- but purchases.price_amount was BIGINT, so Math.floor(0.001) = 0, losing SOL prices entirely

ALTER TABLE purchases ALTER COLUMN price_amount TYPE NUMERIC(20,9) USING price_amount::NUMERIC(20,9);
