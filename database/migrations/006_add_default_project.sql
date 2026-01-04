-- Add default project configuration
-- This ensures we have a project with treasury wallet configured

-- Insert default project if none exists
INSERT INTO projects (
  id,
  name,
  description,
  collection_ids,
  treasury_wallet,
  created_at,
  updated_at
) 
SELECT 
  gen_random_uuid(),
  'Pepe Gods V2',
  'NFT Trait Marketplace for Pepe Gods V2 Collection',
  ARRAY['DywWYUmW9yHbTWBPEKu66WUjvQHSqRTaHCwt21LFiktQ'],
  'PEPELebC2iZctoPd8WtgPQbBYyGL7DonfzfHc9adcH4',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM projects);

-- Add project tokens for the default project
INSERT INTO project_tokens (
  id,
  project_id,
  token_address,
  token_name,
  token_symbol,
  decimals,
  enabled,
  created_at
)
SELECT 
  gen_random_uuid(),
  p.id,
  'E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK',
  'Lazy Dog Zone',
  'LDZ',
  6,
  true,
  NOW()
FROM projects p
WHERE p.name = 'Pepe Gods V2'
AND NOT EXISTS (
  SELECT 1 FROM project_tokens pt 
  WHERE pt.project_id = p.id 
  AND pt.token_symbol = 'LDZ'
);

-- Add SOL token if it doesn't exist
INSERT INTO tokens (id, symbol, mint_address, decimals, enabled, created_at)
SELECT 
  gen_random_uuid(),
  'SOL',
  NULL,
  9,
  true,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM tokens WHERE symbol = 'SOL');

-- Add LDZ token to main tokens table if it doesn't exist
INSERT INTO tokens (id, symbol, mint_address, decimals, enabled, created_at)
SELECT 
  gen_random_uuid(),
  'LDZ',
  'E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK',
  6,
  true,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM tokens WHERE symbol = 'LDZ');