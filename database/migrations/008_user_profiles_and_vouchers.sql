-- Migration: User Profiles with Discord OAuth + Trait Voucher System

-- User profiles (Discord-based)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id VARCHAR(50) UNIQUE NOT NULL,
    discord_username VARCHAR(100) UNIQUE NOT NULL,
    discord_display_name VARCHAR(100),
    discord_avatar VARCHAR(500),
    discord_servers JSONB DEFAULT '[]', -- array of {id, name, icon}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Linked wallets per user profile
CREATE TABLE user_linked_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    wallet_address VARCHAR(44) NOT NULL,
    label VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- Trait vouchers
CREATE TABLE trait_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(12) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    trait_id UUID NOT NULL REFERENCES traits(id),
    slot_id UUID NOT NULL REFERENCES trait_slots(id),
    rarity_tier_id UUID NOT NULL REFERENCES rarity_tiers(id),
    status VARCHAR(20) DEFAULT 'active', -- active, redeemed, revoked
    redeemed_at TIMESTAMP,
    redeemed_purchase_id UUID REFERENCES purchases(id),
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_profiles_discord_username ON user_profiles(discord_username);
CREATE INDEX idx_user_linked_wallets_user_id ON user_linked_wallets(user_id);
CREATE INDEX idx_user_linked_wallets_wallet_address ON user_linked_wallets(wallet_address);
CREATE INDEX idx_trait_vouchers_user_id ON trait_vouchers(user_id);
CREATE INDEX idx_trait_vouchers_code ON trait_vouchers(code);
CREATE INDEX idx_trait_vouchers_status ON trait_vouchers(status);
CREATE INDEX idx_trait_vouchers_trait_id ON trait_vouchers(trait_id);
