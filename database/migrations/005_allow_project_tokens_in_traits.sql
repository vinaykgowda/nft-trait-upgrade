-- Allow traits to reference project tokens
-- This migration removes the foreign key constraint and allows traits to reference either main tokens or project tokens

-- Drop the existing foreign key constraint
ALTER TABLE traits DROP CONSTRAINT IF EXISTS traits_price_token_id_fkey;

-- Add a check constraint to ensure the token ID exists in either table
-- Note: PostgreSQL doesn't support cross-table check constraints directly,
-- so we'll handle validation in the application layer

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_traits_price_token_id ON traits(price_token_id);

-- Add comments to document the change
COMMENT ON COLUMN traits.price_token_id IS 'References either tokens.id or project_tokens.id - validated in application layer';