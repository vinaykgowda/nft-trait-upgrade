import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const migrationSQL = `
-- Initial database schema for NFT Trait Marketplace
-- Run this migration on production database setup

-- Project configuration
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    background_url VARCHAR(500),
    discord_url VARCHAR(500),
    x_url VARCHAR(500),
    magiceden_url VARCHAR(500),
    website_url VARCHAR(500),
    collection_ids TEXT[], -- Core collection addresses
    treasury_wallet VARCHAR(44) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    roles VARCHAR(50)[] DEFAULT ARRAY['admin'],
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret_encrypted VARCHAR(255),
    last_login_at TIMESTAMP,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payment tokens
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    mint_address VARCHAR(44), -- NULL for SOL
    decimals INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Trait organization
CREATE TABLE IF NOT EXISTS trait_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    layer_order INTEGER NOT NULL,
    rules_json JSONB, -- mutual exclusions, dependencies
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rarity_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    weight INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Traits
CREATE TABLE IF NOT EXISTS traits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID REFERENCES trait_slots(id),
    name VARCHAR(255) NOT NULL,
    image_layer_url VARCHAR(500) NOT NULL,
    rarity_tier_id UUID REFERENCES rarity_tiers(id),
    total_supply INTEGER, -- NULL = unlimited
    remaining_supply INTEGER,
    price_amount BIGINT NOT NULL,
    price_token_id UUID REFERENCES tokens(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User management
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gift_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) NOT NULL,
    trait_id UUID REFERENCES traits(id),
    qty_available INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(wallet_address, trait_id)
);

-- Purchase flow
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trait_id UUID REFERENCES traits(id),
    wallet_address VARCHAR(44) NOT NULL,
    asset_id VARCHAR(44) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'reserved',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) NOT NULL,
    asset_id VARCHAR(44) NOT NULL,
    trait_id UUID REFERENCES traits(id),
    price_amount BIGINT NOT NULL,
    token_id UUID REFERENCES tokens(id),
    treasury_wallet VARCHAR(44) NOT NULL,
    status VARCHAR(20) DEFAULT 'created',
    tx_signature VARCHAR(88) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit and monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type VARCHAR(20) NOT NULL, -- admin/user/system
    actor_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    payload_json JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_traits_slot_id ON traits(slot_id);
CREATE INDEX IF NOT EXISTS idx_traits_active ON traits(active);
CREATE INDEX IF NOT EXISTS idx_gift_balances_wallet ON gift_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires ON inventory_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet ON purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Insert default data
INSERT INTO tokens (symbol, mint_address, decimals) VALUES 
('SOL', NULL, 9)
ON CONFLICT DO NOTHING;

INSERT INTO rarity_tiers (name, weight, display_order) VALUES 
('Common', 1, 1),
('Rare', 2, 2),
('Epic', 3, 3),
('Legendary', 4, 4)
ON CONFLICT DO NOTHING;
`;

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow in development or with special header
    const authHeader = request.headers.get('x-migration-key');
    if (process.env.NODE_ENV === 'production' && authHeader !== process.env.MIGRATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    await pool.query(migrationSQL);
    await pool.end();

    return NextResponse.json({ 
      success: true, 
      message: 'Database migration completed successfully' 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}