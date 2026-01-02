// Application constants

export const RESERVATION_TTL_MINUTES = 10;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_DURATION_MINUTES = 30;

export const PURCHASE_STATUS = {
  CREATED: 'created',
  TX_BUILT: 'tx_built',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  FULFILLED: 'fulfilled',
} as const;

export const RESERVATION_STATUS = {
  RESERVED: 'reserved',
  CONSUMED: 'consumed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export const ACTOR_TYPE = {
  ADMIN: 'admin',
  USER: 'user',
  SYSTEM: 'system',
} as const;

export const DEFAULT_RARITY_TIERS = [
  { name: 'Common', weight: 1, displayOrder: 1 },
  { name: 'Uncommon', weight: 2, displayOrder: 2 },
  { name: 'Rare', weight: 3, displayOrder: 3 },
  { name: 'Epic', weight: 4, displayOrder: 4 },
  { name: 'Legendary', weight: 5, displayOrder: 5 },
  { name: 'Mythic', weight: 6, displayOrder: 6 },
];

export const DEFAULT_TRAIT_SLOTS = [
  { name: 'Background', layerOrder: 1 },
  { name: 'Base', layerOrder: 2 },
  { name: 'Clothing', layerOrder: 3 },
  { name: 'Eyes', layerOrder: 4 },
  { name: 'Mouth', layerOrder: 5 },
  { name: 'Hat', layerOrder: 6 },
  { name: 'Accessory', layerOrder: 7 },
];

export const SOLANA_NETWORKS = {
  MAINNET: 'mainnet-beta',
  DEVNET: 'devnet',
  TESTNET: 'testnet',
} as const;

// RPC Configuration
export const RPC_CONFIG = {
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
  SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  HELIUS_RPC_URL: process.env.HELIUS_API_KEY 
    ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com',
} as const;