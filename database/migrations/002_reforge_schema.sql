-- Reforge system schema: packs, orders, combinations, and modifications to existing tables
-- This migration adds the PV Reforge pack-based NFT reforging system

-- ============================================================
-- New Tables
-- ============================================================

-- Reforge Packs
CREATE TABLE IF NOT EXISTS reforge_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id TEXT NOT NULL,
    tier_name TEXT NOT NULL,           -- 'silver', 'gold', 'diamond'
    sol_price NUMERIC(18, 9) NOT NULL, -- Price in SOL
    min_ldz_earning NUMERIC(10, 2) NOT NULL,
    max_ldz_earning NUMERIC(10, 2) NOT NULL,
    total_inventory INTEGER NOT NULL CHECK (total_inventory > 0),
    remaining_count INTEGER NOT NULL CHECK (remaining_count >= 0),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ldz_range_valid CHECK (min_ldz_earning <= max_ldz_earning)
);

-- Reforge Orders
CREATE TABLE IF NOT EXISTS reforge_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES reforge_packs(id),
    wallet_address TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    asset_id TEXT,                      -- Set when user selects NFT
    status TEXT NOT NULL DEFAULT 'bought'
        CHECK (status IN ('bought', 'started_reforge', 'failed', 'completed')),
    used BOOLEAN NOT NULL DEFAULT false,
    purchase_tx_signature TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reforge Combinations (uniqueness tracking)
CREATE TABLE IF NOT EXISTS reforge_combinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES reforge_orders(id),
    collection_id TEXT NOT NULL,
    combination_hash TEXT NOT NULL,     -- SHA-256 of sorted trait IDs
    trait_ids TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_combination UNIQUE (collection_id, combination_hash)
);

-- ============================================================
-- Modifications to Existing Tables
-- ============================================================

-- Add swap pool flag and LDZ earning to traits table
ALTER TABLE traits ADD COLUMN IF NOT EXISTS swap_pool_only BOOLEAN DEFAULT false;
ALTER TABLE traits ADD COLUMN IF NOT EXISTS ldz_earning NUMERIC(10, 2) DEFAULT 0;

-- Add encrypted update authority to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS encrypted_update_authority TEXT;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reforge_orders_wallet ON reforge_orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_reforge_orders_pack ON reforge_orders(pack_id);
CREATE INDEX IF NOT EXISTS idx_reforge_packs_collection ON reforge_packs(collection_id);
CREATE INDEX IF NOT EXISTS idx_reforge_combinations_hash ON reforge_combinations(collection_id, combination_hash);
