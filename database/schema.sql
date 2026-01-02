-- NFT Trait Marketplace Database Schema

-- Project configuration
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    background_url VARCHAR(500),
    discord_url VARCHAR(500),
    x_url VARCHAR(500),
    magiceden_url VARCHAR(500),
    website_url VARCHAR(500),
    collection_ids TEXT[] NOT NULL DEFAULT '{}', -- Core collection addresses
    treasury_wallet VARCHAR(44) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin users
CREATE TABLE admin_users (
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
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    mint_address VARCHAR(44), -- NULL for SOL
    decimals INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Trait organization
CREATE TABLE trait_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    layer_order INTEGER NOT NULL,
    rules_json JSONB, -- mutual exclusions, dependencies
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE rarity_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    weight INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Traits
CREATE TABLE traits (
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
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE gift_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) NOT NULL,
    trait_id UUID REFERENCES traits(id),
    qty_available INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(wallet_address, trait_id)
);

-- Purchase flow
CREATE TABLE inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trait_id UUID REFERENCES traits(id),
    wallet_address VARCHAR(44) NOT NULL,
    asset_id VARCHAR(44) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'reserved',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchases (
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
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type VARCHAR(20) NOT NULL, -- admin/user/system
    actor_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    payload_json JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_traits_slot_id ON traits(slot_id);
CREATE INDEX idx_traits_rarity_tier_id ON traits(rarity_tier_id);
CREATE INDEX idx_traits_active ON traits(active);
CREATE INDEX idx_inventory_reservations_trait_id ON inventory_reservations(trait_id);
CREATE INDEX idx_inventory_reservations_expires_at ON inventory_reservations(expires_at);
CREATE INDEX idx_purchases_wallet_address ON purchases(wallet_address);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_gift_balances_wallet_address ON gift_balances(wallet_address);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Insert default SOL token
INSERT INTO tokens (symbol, mint_address, decimals, enabled) 
VALUES ('SOL', NULL, 9, TRUE);

-- Insert default rarity tiers
INSERT INTO rarity_tiers (name, weight, display_order) VALUES
('Common', 1, 1),
('Uncommon', 2, 2),
('Rare', 3, 3),
('Epic', 4, 4),
('Legendary', 5, 5),
('Mythic', 6, 6);

-- Insert default trait slots
INSERT INTO trait_slots (name, layer_order) VALUES
('Background', 1),
('Base', 2),
('Clothing', 3),
('Eyes', 4),
('Mouth', 5),
('Hat', 6),
('Accessory', 7);