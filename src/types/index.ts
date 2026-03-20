// Core type definitions for the NFT trait marketplace

export interface CoreAsset {
  address: string;
  name: string;
  image: string;
  collection?: string;
  symbol?: string;
  seller_fee_basis_points?: number;
  attributes?: Attribute[];
}

export interface Attribute {
  trait_type: string;
  value: string;
}

export interface Trait {
  id: string;
  slotId: string;
  name: string;
  imageLayerUrl: string;
  rarityTier: RarityTier;
  totalSupply?: number;
  remainingSupply?: number;
  priceAmount: string; // Changed from bigint to string
  priceToken: Token;
  earnerToken?: Token;
  earnerAmount?: string;
  active: boolean;
}

export interface RarityTier {
  id: string;
  name: string;
  weight: number;
  displayOrder: number;
}

export interface Token {
  id: string;
  symbol: string;
  mintAddress?: string; // NULL for SOL
  decimals: number;
  enabled: boolean;
}

export interface TraitSlot {
  id: string;
  name: string;
  layerOrder: number;
  rulesJson?: any; // mutual exclusions, dependencies
}

export interface Purchase {
  id: string;
  walletAddress: string;
  assetId: string;
  traitId: string;
  priceAmount: string; // Changed from bigint to string
  tokenId: string;
  treasuryWallet: string; // Added missing field
  status: PurchaseStatus;
  txSignature?: string;
  reservationId?: string; // Link to reservation
}

export type PurchaseStatus = 'created' | 'tx_built' | 'confirmed' | 'failed' | 'fulfilled' | 'pending';

export interface ReservationRequest {
  walletAddress: string;
  assetId: string;
  traitId: string;
}

export interface AtomicTransaction {
  paymentInstruction: any; // TransactionInstruction
  updateInstruction: any; // TransactionInstruction
  partialSignatures: any[]; // Signature[]
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  backgroundUrl?: string;
  discordUrl?: string;
  xUrl?: string;
  magicedenUrl?: string;
  websiteUrl?: string;
  collectionIds: string[];
  treasuryWallet: string;
  sellerFeeBasisPoints?: number;
  collectionSymbol?: string;
  creatorAddress?: string;
  supportsSol?: boolean;
  tokens?: ProjectToken[];
}

export interface ProjectToken {
  id: string;
  projectId: string;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  decimals: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  roles: string[];
  mfaEnabled: boolean;
  lastLoginAt?: Date;
}

export interface GiftBalance {
  id: string;
  walletAddress: string;
  traitId: string;
  qtyAvailable: number;
}

export interface InventoryReservation {
  id: string;
  traitId: string;
  walletAddress: string;
  assetId: string;
  expiresAt: Date;
  status: 'reserved' | 'consumed' | 'expired' | 'cancelled';
}

export interface AuditLog {
  id: string;
  actorType: 'admin' | 'user' | 'system';
  actorId?: string;
  action: string;
  payloadJson?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Pinata IPFS Upload Types
export interface PinataUploadResult {
  cid: string;           // IPFS Content Identifier
  url: string;           // Full gateway URL
  size: number;          // File size in bytes
  contentType: string;   // MIME type
}

export interface NFTMetadata {
  name: string;
  description: string;
  symbol?: string;
  seller_fee_basis_points?: number;
  image: string;  // IPFS gateway URL
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;        // IPFS gateway URL
      type: string;       // MIME type (e.g., "image/webp")
    }>;
    category?: string;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };
}


// User Profile (Discord-based)
export interface UserProfile {
  id: string;
  discordId: string;
  discordUsername: string;
  discordDisplayName?: string;
  discordAvatar?: string;
  discordServers?: DiscordServer[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscordServer {
  id: string;
  name: string;
  icon?: string;
}

export interface UserLinkedWallet {
  id: string;
  userId: string;
  walletAddress: string;
  label?: string;
  verified: boolean;
  createdAt: string;
}

// Trait Vouchers
export type VoucherStatus = 'active' | 'redeemed' | 'revoked';

export interface TraitVoucher {
  id: string;
  code: string;
  userId: string;
  traitId: string;
  slotId: string;
  rarityTierId: string;
  status: VoucherStatus;
  redeemedAt?: string;
  redeemedPurchaseId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  discordUsername?: string;
  traitName?: string;
  slotName?: string;
  rarityName?: string;
}

