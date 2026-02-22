-- Add seller_fee_basis_points, collection_symbol, and creator_address to projects table
-- These were previously hardcoded in env vars but should be per-project and admin-configurable

ALTER TABLE projects 
ADD COLUMN seller_fee_basis_points INTEGER NOT NULL DEFAULT 690,
ADD COLUMN collection_symbol VARCHAR(20) NOT NULL DEFAULT 'PGV2',
ADD COLUMN creator_address VARCHAR(44);
