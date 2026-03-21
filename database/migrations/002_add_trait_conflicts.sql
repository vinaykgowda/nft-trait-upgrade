-- Migration: Add trait conflicts table
-- Date: 2026-03-21

-- Create trait conflicts table
CREATE TABLE IF NOT EXISTS trait_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trait_id UUID REFERENCES traits(id) ON DELETE CASCADE,
    conflicts_with_trait_id UUID REFERENCES traits(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(trait_id, conflicts_with_trait_id)
);

-- Add index for faster conflict lookups
CREATE INDEX IF NOT EXISTS idx_trait_conflicts_trait_id 
ON trait_conflicts(trait_id);

CREATE INDEX IF NOT EXISTS idx_trait_conflicts_conflicts_with 
ON trait_conflicts(conflicts_with_trait_id);

COMMENT ON TABLE trait_conflicts IS 
'Defines which traits cannot be applied together on the same NFT';
