-- Migration: Add proper rarity tiers
-- This migration adds the standard rarity tiers: Mythic, Legendary, Rare, Uncommon, Common

-- First, clear existing rarity tiers if any
DELETE FROM rarity_tiers;

-- Insert the standard rarity tiers with proper ordering and weights
INSERT INTO rarity_tiers (id, name, weight, display_order, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Common', 50, 1, NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Uncommon', 30, 2, NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'Rare', 15, 3, NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 'Legendary', 4, 4, NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', 'Mythic', 1, 5, NOW());

-- Update any existing traits to use Common rarity if they have NULL rarity_tier_id
UPDATE traits 
SET rarity_tier_id = '550e8400-e29b-41d4-a716-446655440001' 
WHERE rarity_tier_id IS NULL;

-- Update any existing traits to use SOL token if they have NULL price_token_id
UPDATE traits 
SET price_token_id = (SELECT id FROM tokens WHERE symbol = 'SOL' LIMIT 1)
WHERE price_token_id IS NULL;