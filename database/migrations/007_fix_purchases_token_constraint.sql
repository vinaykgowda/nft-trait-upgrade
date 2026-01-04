-- Fix purchases table to allow project tokens
-- This migration removes the foreign key constraint on purchases.token_id to allow project tokens

-- Drop the existing foreign key constraint on purchases table
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_token_id_fkey;

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_purchases_token_id ON purchases(token_id);

-- Add comments to document the change
COMMENT ON COLUMN purchases.token_id IS 'References either tokens.id or project_tokens.id - validated in application layer';