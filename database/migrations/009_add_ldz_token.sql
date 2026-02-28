-- Add LDZ token to the main tokens table
-- This is needed so traits can reference LDZ as a payment token

INSERT INTO tokens (symbol, mint_address, decimals, enabled)
VALUES ('LDZ', 'E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK', 9, true)
ON CONFLICT DO NOTHING;
