-- ============================================================
-- Fresh schema for new Vercel/NeonDB instance
-- No data included - structure only
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES (in dependency order)
-- ============================================================

CREATE TABLE projects (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(500),
  background_url VARCHAR(500),
  discord_url VARCHAR(500),
  x_url VARCHAR(500),
  magiceden_url VARCHAR(500),
  website_url VARCHAR(500),
  collection_ids TEXT[],
  treasury_wallet VARCHAR(44) NOT NULL,
  supports_sol BOOLEAN DEFAULT true,
  seller_fee_basis_points INTEGER NOT NULL DEFAULT 690,
  collection_symbol VARCHAR(20) NOT NULL DEFAULT 'PGV2',
  creator_address VARCHAR(44),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  roles TEXT[] DEFAULT ARRAY['admin'::text],
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret_encrypted VARCHAR(255),
  last_login_at TIMESTAMP WITHOUT TIME ZONE,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (username)
);

CREATE TABLE audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  payload_json JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) NOT NULL,
  mint_address VARCHAR(44),
  decimals INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE project_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id UUID,
  token_address VARCHAR(44) NOT NULL,
  token_name VARCHAR(100),
  token_symbol VARCHAR(10),
  decimals INTEGER DEFAULT 9,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (project_id, token_address),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE rarity_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  weight INTEGER NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE trait_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  layer_order INTEGER NOT NULL,
  rules_json JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE traits (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  slot_id UUID,
  name VARCHAR(255) NOT NULL,
  image_layer_url VARCHAR(500) NOT NULL,
  rarity_tier_id UUID,
  total_supply INTEGER,
  remaining_supply INTEGER,
  price_amount NUMERIC(20,9) NOT NULL,
  price_token_id UUID,
  active BOOLEAN DEFAULT true,
  earner_token_id UUID,
  earner_amount NUMERIC(20,9),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (slot_id) REFERENCES trait_slots(id),
  FOREIGN KEY (rarity_tier_id) REFERENCES rarity_tiers(id)
);

CREATE TABLE trait_conflicts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  trait_id UUID,
  conflicts_with_trait_id UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (trait_id, conflicts_with_trait_id),
  FOREIGN KEY (trait_id) REFERENCES traits(id) ON DELETE CASCADE,
  FOREIGN KEY (conflicts_with_trait_id) REFERENCES traits(id) ON DELETE CASCADE
);

CREATE TABLE user_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  last_seen_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (wallet_address)
);

CREATE TABLE user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  discord_id VARCHAR(50) NOT NULL,
  discord_username VARCHAR(100) NOT NULL,
  discord_display_name VARCHAR(100),
  discord_avatar VARCHAR(500),
  discord_servers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (discord_id),
  UNIQUE (discord_username)
);

CREATE TABLE user_linked_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_address VARCHAR(44) NOT NULL,
  label VARCHAR(100),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (wallet_address),
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

CREATE TABLE gift_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) NOT NULL,
  trait_id UUID,
  qty_available INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (wallet_address, trait_id),
  FOREIGN KEY (trait_id) REFERENCES traits(id)
);

CREATE TABLE inventory_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  trait_id UUID,
  wallet_address VARCHAR(44) NOT NULL,
  asset_id VARCHAR(44) NOT NULL,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'reserved',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (wallet_address, asset_id, trait_id, status),
  FOREIGN KEY (trait_id) REFERENCES traits(id)
);

CREATE TABLE purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) NOT NULL,
  asset_id VARCHAR(44) NOT NULL,
  trait_id UUID,
  price_amount NUMERIC(20,9) NOT NULL,
  token_id UUID,
  treasury_wallet VARCHAR(44) NOT NULL,
  status VARCHAR(20) DEFAULT 'created',
  tx_signature VARCHAR(88),
  reservation_id UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tx_signature),
  FOREIGN KEY (trait_id) REFERENCES traits(id),
  FOREIGN KEY (reservation_id) REFERENCES inventory_reservations(id)
);

CREATE TABLE trait_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR(12) NOT NULL,
  user_id UUID NOT NULL,
  trait_id UUID NOT NULL,
  slot_id UUID NOT NULL,
  rarity_tier_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  redeemed_at TIMESTAMP WITHOUT TIME ZONE,
  redeemed_purchase_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (code),
  FOREIGN KEY (user_id) REFERENCES user_profiles(id),
  FOREIGN KEY (trait_id) REFERENCES traits(id),
  FOREIGN KEY (slot_id) REFERENCES trait_slots(id),
  FOREIGN KEY (rarity_tier_id) REFERENCES rarity_tiers(id),
  FOREIGN KEY (redeemed_purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (created_by) REFERENCES admin_users(id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_audit_logs_created ON audit_logs USING btree (created_at);

CREATE INDEX idx_gift_balances_wallet ON gift_balances USING btree (wallet_address);

CREATE INDEX idx_inventory_reservations_expires ON inventory_reservations USING btree (expires_at);
CREATE INDEX idx_inventory_reservations_status_expires ON inventory_reservations USING btree (status, expires_at);

CREATE INDEX idx_project_tokens_project_id ON project_tokens USING btree (project_id);
CREATE INDEX idx_project_tokens_enabled ON project_tokens USING btree (enabled);

CREATE INDEX idx_purchases_wallet ON purchases USING btree (wallet_address);
CREATE INDEX idx_purchases_status_created ON purchases USING btree (status, created_at);
CREATE INDEX idx_purchases_token_id ON purchases USING btree (token_id);

CREATE INDEX idx_trait_conflicts_trait_id ON trait_conflicts USING btree (trait_id);
CREATE INDEX idx_trait_conflicts_conflicts_with ON trait_conflicts USING btree (conflicts_with_trait_id);

CREATE INDEX idx_trait_vouchers_code ON trait_vouchers USING btree (code);
CREATE INDEX idx_trait_vouchers_user_id ON trait_vouchers USING btree (user_id);
CREATE INDEX idx_trait_vouchers_trait_id ON trait_vouchers USING btree (trait_id);
CREATE INDEX idx_trait_vouchers_status ON trait_vouchers USING btree (status);

CREATE INDEX idx_traits_slot_id ON traits USING btree (slot_id);
CREATE INDEX idx_traits_active ON traits USING btree (active);
CREATE INDEX idx_traits_price_token_id ON traits USING btree (price_token_id);
CREATE INDEX idx_traits_earner_token_id ON traits USING btree (earner_token_id);

CREATE INDEX idx_user_linked_wallets_user_id ON user_linked_wallets USING btree (user_id);
CREATE INDEX idx_user_linked_wallets_wallet_address ON user_linked_wallets USING btree (wallet_address);

CREATE INDEX idx_user_profiles_discord_username ON user_profiles USING btree (discord_username);
