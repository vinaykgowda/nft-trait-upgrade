-- Add earner token and amount fields to traits
-- These are optional fields that indicate what token/amount a user earns when purchasing this trait

ALTER TABLE traits ADD COLUMN IF NOT EXISTS earner_token_id UUID;
ALTER TABLE traits ADD COLUMN IF NOT EXISTS earner_amount NUMERIC(20,9);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_traits_earner_token_id ON traits(earner_token_id);

COMMENT ON COLUMN traits.earner_token_id IS 'Optional: references tokens.id or project_tokens.id - token earned by purchaser';
COMMENT ON COLUMN traits.earner_amount IS 'Optional: amount of earner token earned by purchaser';
